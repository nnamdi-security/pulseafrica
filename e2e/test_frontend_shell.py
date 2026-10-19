"""The new Next.js frontend's shared shell: ticker, nav and footer (Milestone 5, decisions 0016–0019).

These run against the built app on 127.0.0.1:3000 (see conftest.py). As pages move in
Milestones 6–8, each journey above gains its new route; until then only the shell exists."""

import re
from pathlib import Path

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, User, api

SCREENSHOTS = Path(__file__).parent / "screenshots"
axe = Axe()


def phone(page: Page) -> Page:
    page.set_viewport_size({"width": 390, "height": 844})
    return page


def sign_in_with_cookie(page: Page, app_url: str, user: User) -> None:
    """Sign in the way the new frontend will: the API sets the HttpOnly session cookie (decision 0011)."""
    res = page.request.post(app_url + "/api/auth/login", data={"email": user.email, "password": user.password})
    assert res.status == 200, res.text()


def test_ticker_goes_live_with_the_api_figures(page: Page, app_url, console_errors):
    status, stats = api("GET", "/stats")
    assert status == 200
    page.goto(app_url + "/")
    ticker = page.get_by_test_id("ticker")
    expect(ticker).to_have_attribute("data-state", "live")
    # The seed is demonstration data, and the ticker says so first (METH-01)
    expect(ticker).to_have_attribute("aria-label", "Live platform figures, including demonstration data")
    first = ticker.locator(":scope > div > div:not([aria-hidden])")
    expect(first.first).to_contain_text("Demonstration data")
    expect(first.filter(has_text="Active polls")).to_contain_text(f"{stats['activePolls']:,}")
    expect(first.filter(has_text="Total responses")).to_contain_text(f"{stats['totalResponses']:,}")


def test_ticker_and_nav_without_the_api(page: Page, app_url, console_errors):
    page.route(re.compile(r".*/api/.*"), lambda route: route.abort("connectionrefused"))
    page.goto(app_url + "/")
    expect(page.get_by_role("link", name="Sign in")).to_be_visible()
    ticker = page.get_by_test_id("ticker")
    expect(ticker).to_have_attribute("data-state", "placeholder")
    expect(ticker).to_contain_text("Independent civic opinion research")
    expect(ticker).not_to_contain_text("Active polls")


def test_nav_links_and_keyboard(page: Page, app_url):
    page.goto(app_url + "/")
    nav = page.get_by_role("navigation", name="Main navigation")
    expect(nav.get_by_role("link", name="Home", exact=True)).to_have_attribute("aria-current", "page")
    for name, href in [("Polls", "/polls"), ("Results", "/results"), ("Methodology", "/methodology"),
                       ("About", "/about"), ("Sign in", "/login")]:
        expect(nav.get_by_role("link", name=name, exact=True)).to_have_attribute("href", href)

    # Keyboard order: home link, then the menu links, then the button
    page.keyboard.press("Tab")
    expect(nav.get_by_role("link", name="PulseAfrica home")).to_be_focused()
    for name in ["Home", "Polls", "Results", "Methodology", "About", "Sign in"]:
        page.keyboard.press("Tab")
        expect(nav.get_by_role("link", name=name, exact=True)).to_be_focused()
    page.keyboard.press("Tab")
    expect(nav.get_by_role("button", name="Share Your Voice")).to_be_focused()


def test_footer_links_only_to_real_pages(page: Page, app_url):
    page.goto(app_url + "/")
    footer = page.get_by_role("contentinfo")
    for name, href in [("Active Polls", "/polls"), ("Results Dashboard", "/results"), ("Methodology", "/methodology"),
                       ("Our Mission", "/about")]:
        expect(footer.get_by_role("link", name=name, exact=True)).to_have_attribute("href", href)
    expect(footer.get_by_text("Privacy Policy")).to_be_visible()
    expect(footer.get_by_role("link", name="Privacy Policy")).to_have_count(0)
    expect(footer.locator('a[href="#"]')).to_have_count(0)
    expect(footer).to_contain_text("Totals Only")


def test_mobile_menu_at_390px(page: Page, app_url):
    phone(page).goto(app_url + "/")
    nav = page.get_by_role("navigation", name="Main navigation")
    expect(nav.get_by_role("link", name="Polls")).to_be_hidden()
    nav.get_by_role("button", name="Open navigation menu").click()
    expect(nav.get_by_role("button", name="Close navigation menu")).to_have_attribute("aria-expanded", "true")
    expect(nav.get_by_role("link", name="Polls")).to_be_visible()
    expect(nav.get_by_role("link", name="Sign in")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth") <= 390


@pytest.mark.parametrize("path", ["/", "/polls/1"])
@pytest.mark.parametrize("width", [1280, 390])
def test_no_horizontal_scroll(page: Page, app_url, path, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    expect(page.get_by_test_id("ticker")).to_have_attribute("data-state", "live")
    assert page.evaluate("document.documentElement.scrollWidth") <= width


def test_signed_in_nav_uses_the_session_cookie(page: Page, app_url, citizen, console_errors):
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/")
    nav = page.get_by_role("navigation", name="Main navigation")
    name = nav.get_by_role("link", name=re.compile(r"Your dashboard, signed in as\s*Ngozi"))
    expect(name).to_have_attribute("href", "/dashboard")
    expect(nav.get_by_role("link", name="Admin")).to_have_count(0)
    # The token is never readable by JavaScript (SEC-04)
    assert "pa_session" not in page.evaluate("document.cookie")
    assert any(c["name"] == "pa_session" and c["httpOnly"] for c in page.context.cookies())

    nav.get_by_role("button", name="Sign out").click()
    expect(nav.get_by_role("link", name="Sign in")).to_be_focused()
    # Signed out on the server too: the old token no longer works (decision 0010)
    status, _ = api("GET", "/auth/me", token=citizen.token)
    assert status == 401


def test_admins_get_the_admin_link(page: Page, app_url, admin):
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/")
    expect(page.get_by_role("link", name="Admin")).to_have_attribute("href", "/admin")


# Next.js keeps the old query string, so /poll.html?id=3 lands on /polls/3?id=3; the new pages ignore it.
@pytest.mark.parametrize("old, new", [
    ("/index.html", "/"),
    ("/poll.html?id=3", "/polls/3"),
    ("/poll.html", "/polls"),
    ("/results.html?id=4", "/results/4"),
    ("/methodology.html", "/methodology"),
    ("/login.html#register", "/register"),
    ("/dashboard.html#settings", "/dashboard/settings"),
    ("/admin.html#users", "/admin/users"),
])
def test_old_links_land_on_the_new_routes(page: Page, app_url, old, new):
    page.goto(app_url + old)
    expect(page).to_have_url(re.compile(re.escape(app_url + new) + r"(\?[^#]*)?$"))


def test_unknown_route_shows_the_shell_and_a_not_found_page(page: Page, app_url):
    page.goto(app_url + "/no-such-page")
    expect(page.get_by_role("heading", level=1, name="Page not found")).to_be_visible()
    expect(page.get_by_role("navigation", name="Main navigation")).to_be_visible()
    expect(page.get_by_role("contentinfo")).to_be_visible()


@pytest.mark.parametrize("path", ["/", "/no-such-page"])
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_including_contrast(page: Page, app_url, path, width):
    """Unlike the current pages, the new frontend passes axe's contrast rule (FE-03, decision 0017)."""
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    expect(page.get_by_test_id("ticker")).to_have_attribute("data-state", "live")
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
               for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []


@pytest.mark.parametrize("width", [1280, 390])
def test_shell_screenshots(page: Page, app_url, width):
    """Current and new shell side by side, for the owner's review on the PR (CI keeps them as an artifact)."""
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    for label, url, ticker in [("current", SITE + "/index.html", ".ticker"), ("new", app_url + "/", "[data-testid=ticker]")]:
        page.goto(url)
        # Live figures in both tickers before the shot. (Not "networkidle": until the pages exist,
        # Next.js keeps its prefetches of the nav's 404 routes open.)
        expect(page.locator(ticker)).to_have_attribute("aria-label", re.compile("^Live platform figures"))
        page.wait_for_function("() => document.fonts.ready.then(() => true)")
        nav = page.get_by_role("navigation", name="Main navigation")
        top = nav.bounding_box()
        page.screenshot(path=SCREENSHOTS / f"{width}-header-{label}.png", animations="disabled",
                        clip={"x": 0, "y": 0, "width": width, "height": top["y"] + top["height"]})
        page.get_by_role("contentinfo").screenshot(path=SCREENSHOTS / f"{width}-footer-{label}.png",
                                                   animations="disabled")
