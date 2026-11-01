"""Launch content in the new frontend (Milestone 9, D63–D65): the Privacy and Terms pages, the
demonstration-site notice, and About's reviewed copy."""

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from test_frontend_shell import SCREENSHOTS

axe = Axe()


def test_every_page_says_it_is_a_demonstration(page: Page, app_url):
    for path in ["/", "/polls", "/login"]:
        page.goto(app_url + path)
        banner = page.get_by_role("complementary", name="Demonstration site")
        expect(banner).to_contain_text("they are not real research")
    banner.get_by_role("link", name="About the project").click()
    expect(page).to_have_url(app_url + "/about#project-heading")
    expect(page.get_by_role("heading", name="An independent portfolio project")).to_be_visible()


def test_about_no_longer_claims_a_team_or_usage_figures(page: Page, app_url):
    page.goto(app_url + "/about")
    main = page.get_by_role("main")
    for retired in ["The people behind the data", "Founder & Director", "20,000", "44,210", "1,840"]:
        expect(main).not_to_contain_text(retired)
    expect(main).to_contain_text("every poll on this site are fictional")


def test_methodology_funding_answer(page: Page, app_url):
    page.goto(app_url + "/methodology")
    expect(page.get_by_role("main")).not_to_contain_text("grant model")
    expect(page.get_by_role("main")).to_contain_text("nobody commissions or pays for its polls")


@pytest.mark.parametrize("path, heading", [("/privacy", "Privacy notice"), ("/terms", "Terms of use")])
def test_legal_pages(page: Page, app_url, path, heading, console_errors):
    page.goto(app_url + "/")
    page.get_by_role("contentinfo").get_by_role("link", name="Privacy Policy" if path == "/privacy" else "Terms of Use").click()
    expect(page).to_have_url(app_url + path)
    expect(page.get_by_role("heading", level=1)).to_have_text(heading)
    expect(page).to_have_title(("Privacy" if path == "/privacy" else "Terms of Use") + " — PulseAfrica")


def test_cookie_link_lands_on_the_cookie_section(page: Page, app_url):
    page.goto(app_url + "/")
    page.get_by_role("contentinfo").get_by_role("link", name="Cookie Policy").click()
    expect(page).to_have_url(app_url + "/privacy#cookies")
    expect(page.get_by_role("heading", name="Cookies")).to_be_in_viewport()


def test_register_links_to_the_terms_in_a_new_tab(page: Page, app_url):
    page.goto(app_url + "/register")
    for name, href in [("Terms of Use", "/terms"), ("Privacy Policy", "/privacy")]:
        link = page.locator("form").get_by_role("link", name=name, exact=True)
        expect(link).to_have_attribute("href", href)
        expect(link).to_have_attribute("target", "_blank")


@pytest.mark.parametrize("path", ["/privacy", "/terms", "/about"])
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_fit_and_screenshots(page: Page, app_url, path, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    page.wait_for_function("() => document.fonts.ready.then(() => true)")
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']})" for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    SCREENSHOTS.mkdir(exist_ok=True)
    page.screenshot(path=SCREENSHOTS / f"{width}-m9{path.replace('/', '-')}.png", full_page=True, animations="disabled")
