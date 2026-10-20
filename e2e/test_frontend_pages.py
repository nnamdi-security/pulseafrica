"""The public pages in the new Next.js frontend (Milestone 6, decisions 0021–0023).

Each page moved from the static site gets its journeys here, run against the built app on
127.0.0.1:3000, plus axe with the contrast rule (decision 0017), a no-horizontal-scroll check,
and screenshots of the current and new page side by side for the owner's sign-off (D39)."""

import re

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# Every route Milestone 6 has moved so far, with the static page it replaces
PAGES = {
    "/methodology": "/methodology.html",
    "/about": "/about.html",
}


def wait_for_page(page: Page) -> None:
    """Live ticker and loaded fonts: the page is in its final state"""
    expect(page.locator("[data-testid=ticker], .ticker").first).to_have_attribute(
        "aria-label", re.compile("^Live platform figures"))
    page.wait_for_function("() => document.fonts.ready.then(() => true)")


def test_methodology_sections_and_jump_links(page: Page, app_url, console_errors):
    page.goto(app_url + "/methodology")
    expect(page.get_by_role("heading", level=1, name="Polling methodology")).to_be_visible()
    jump = page.get_by_role("navigation", name="Jump to section")
    names = ["What is polling?", "How polling works", "Sample collection", "Weighting (planned)", "Sample size",
             "Limitations", "What we don't do", "FAQ"]
    expect(jump.get_by_role("link")).to_have_text(names)
    expect(page.get_by_role("heading", level=2)).to_have_count(8)
    # Six questions in the FAQ, word for word from the static page (D37)
    expect(page.locator("#sec-faq h3")).to_have_count(6)

    jump.get_by_role("link", name="FAQ").click()
    expect(page).to_have_url(re.compile(r"/methodology#sec-faq$"))
    expect(page.get_by_role("heading", name="Frequently asked questions")).to_be_in_viewport()
    expect(jump.get_by_role("link", name="FAQ")).to_have_attribute("aria-current", "true")

    page.get_by_role("link", name="Participate in a poll").click()
    expect(page).to_have_url(app_url + "/polls")


def test_methodology_deep_link(page: Page, app_url):
    page.goto(app_url + "/methodology#sec-weighting")
    expect(page.get_by_role("heading", name="Weighting (planned)", level=2)).to_be_in_viewport()


def test_about_page(page: Page, app_url, console_errors):
    page.goto(app_url + "/about")
    expect(page.get_by_role("heading", level=1)).to_have_text(re.compile(r"^Data is how citizens\s*hold power accountable\.$"))
    for heading in ["What we stand for", "How PulseAfrica came to be", "The people behind the data",
                    "What we are building toward", "Be part of the record."]:
        expect(page.get_by_role("heading", level=2, name=heading)).to_be_visible()
    expect(page.get_by_role("list", name="PulseAfrica history timeline").get_by_role("listitem")).to_have_count(5)
    expect(page.get_by_role("link", name="Read our methodology")).to_have_attribute("href", "/methodology")
    expect(page.get_by_role("link", name="Participate in a poll")).to_have_attribute("href", "/polls")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, path):
    """Ported word for word (D37): every heading of the static page is on the new one"""
    page.goto(SITE + PAGES[path])
    old = [" ".join(t.split()) for t in page.locator("main h2, main h3, .meth-hero h1, .about-hero h1, "
                                                     "body > section h2, body > section h3").all_inner_texts()]
    page.goto(app_url + path)
    new = {" ".join(t.split()) for t in page.locator("main h1, main h2, main h3").all_inner_texts()}
    assert [h for h in old if h not in new] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_and_no_horizontal_scroll(page: Page, app_url, path, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    wait_for_page(page)
    assert page.evaluate("document.documentElement.scrollWidth") <= width
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
               for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_page_screenshots(page: Page, app_url, path, width):
    """Current and new page, full length, for the owner's sign-off on the PR (D39; CI keeps them as an artifact)"""
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    name = path.strip("/").replace("/", "-") or "home"
    for label, url in [("current", SITE + PAGES[path]), ("new", app_url + path)]:
        page.goto(url)
        wait_for_page(page)
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")
