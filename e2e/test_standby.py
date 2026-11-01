"""The Netlify rollback standby (Milestone 9, decision 0028, D60; SEC-07).

scripts/build_standby.py copies the static pages into a folder with a _headers file. Here the
browser is served that folder as the host would serve it, headers included, with /api proxied
to the suite's API (as the standby's proxy does during a rollback), and every page has to run
under its Content-Security-Policy without a violation."""

import mimetypes
import subprocess
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, Route, expect

from conftest import API, ROOT

STANDBY = "https://standby.pulseafrica.test"
PAGES = ["index", "polls", "poll", "results", "methodology", "about", "login", "dashboard", "admin"]

WATCH_VIOLATIONS = """
window.__cspViolations = [];
document.addEventListener('securitypolicyviolation', e =>
  window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
"""


@pytest.fixture(scope="module")
def site(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("standby") / "_site"
    subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "build_standby.py"), str(out)], check=True)
    return out


def parse_headers(site: Path) -> dict[str, dict[str, str]]:
    rules: dict[str, dict[str, str]] = {}
    path = None
    for line in (site / "_headers").read_text().splitlines():
        if line and not line.startswith(" "):
            path = line.strip()
            rules[path] = {}
        elif line.strip():
            name, value = line.strip().split(": ", 1)
            rules[path][name] = value
    return rules


def serve(page: Page, site: Path) -> None:
    rules = parse_headers(site)

    def handle(route: Route) -> None:
        path = route.request.url.removeprefix(STANDBY).split("?")[0].split("#")[0]
        if path.startswith("/api/"):
            route.fulfill(response=route.fetch(url=API + path.removeprefix("/api") +
                                               ("?" + route.request.url.split("?", 1)[1] if "?" in route.request.url else "")))
            return
        file = site / ("index.html" if path == "/" else path.lstrip("/"))
        if not file.is_file():
            route.fulfill(status=404, body="Not found")
            return
        headers = {**rules["/*"], **rules.get(path, {}), "Content-Type": mimetypes.guess_type(file.name)[0] or "text/plain"}
        route.fulfill(status=200, headers=headers, body=file.read_bytes())

    page.route(STANDBY + "/**", handle)
    page.add_init_script(WATCH_VIOLATIONS)


def test_build_copies_only_the_static_pages(site: Path):
    names = {p.name for p in site.iterdir()}
    assert names == {*(f"{p}.html" for p in PAGES), "style.css", "api.js", "nav-auth.js", "ticker.js", "images", "_headers"}
    assert "'/api'" in (site / "api.js").read_text() and "localhost:8000" not in (site / "api.js").read_text()


def test_every_page_has_a_policy_with_its_own_script_hash(site: Path):
    rules = parse_headers(site)
    assert rules["/*"]["X-Frame-Options"] == "DENY"
    for name in PAGES:
        policy = rules[f"/{name}.html"]["Content-Security-Policy"]
        assert policy == rules[f"/{name}"]["Content-Security-Policy"]
        assert "'sha256-" in policy and "unsafe-inline" not in policy.split("style-src")[0]
        assert "frame-ancestors 'none'" in policy


@pytest.mark.parametrize("name", PAGES)
def test_pages_run_under_their_policy(page: Page, site: Path, name: str, console_errors):
    serve(page, site)
    page.goto(f"{STANDBY}/{name}.html")
    # The ticker goes live only if the page's inline script and api.js ran and /api answered
    expect(page.locator(".ticker")).to_have_attribute("aria-label", "Live platform figures, including demonstration data")
    assert page.evaluate("window.__cspViolations") == []


def test_sign_in_and_dashboard_on_the_standby(page: Page, site: Path, citizen, console_errors):
    serve(page, site)
    page.goto(f"{STANDBY}/index.html")
    page.evaluate("token => localStorage.setItem('pulseafrica.token', token)", citizen.token)
    page.goto(f"{STANDBY}/dashboard.html")
    expect(page.locator("body")).to_contain_text(citizen.full_name.split()[0])
    assert page.evaluate("window.__cspViolations") == []


def test_a_script_the_policy_does_not_name_is_blocked(page: Page, site: Path, tmp_path: Path):
    """The policy is doing work: a page whose inline script changed after the build doesn't run it"""
    changed = tmp_path / "_site"
    subprocess.run(["cp", "-r", str(site), str(changed)], check=True)
    about = changed / "about.html"
    about.write_text(about.read_text().replace("<script>", "<script>window.__injected = true;", 1))
    serve(page, changed)
    page.goto(f"{STANDBY}/about.html")
    page.wait_for_function("window.__cspViolations.length > 0")
    assert page.evaluate("window.__injected") is None
