"""Journey 5 on frontend/ (Milestone 7, PR 2): the dashboard's guard, Overview and Participation history.

The settings tab (profile, password, delete) arrives in PR 3, with the rest of test_dashboard.py's journey.
"""

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, api, sign_in
from test_dashboard import COST_OF_LIVING, respond
from test_frontend_pages import seeded, sign_in_with_cookie, wait_for_page
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# The new routes, with the static view each replaces
PAGES = {"/dashboard": "/dashboard.html", "/dashboard/history": "/dashboard.html#history"}


def test_signed_out_visitors_are_asked_to_sign_in_and_come_back(page: Page, app_url, citizen, console_errors):
    page.goto(app_url + "/dashboard/history")
    main = page.get_by_role("main")
    expect(main.get_by_text("Sign in to see your dashboard")).to_be_visible()
    expect(page.get_by_role("tablist")).to_have_count(0)
    expect(main.get_by_role("link", name="create an account")).to_have_attribute("href", "/register?next=/dashboard/history")

    main.get_by_role("link", name="Sign in").click()
    expect(page).to_have_url(app_url + "/login?next=/dashboard/history")
    form = page.get_by_role("form", name="Sign in")
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page).to_have_url(app_url + "/dashboard/history")
    expect(page.get_by_role("heading", level=1)).to_have_text("Welcome back, Ngozi")
    expect(page.get_by_role("tab", name="Participation history")).to_have_attribute("aria-selected", "true")


def test_overview_and_history(page: Page, app_url, citizen, console_errors):
    poll = seeded(COST_OF_LIVING)
    respond(citizen, poll)
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/dashboard")

    expect(page.get_by_role("heading", level=1)).to_have_text("Welcome back, Ngozi")
    expect(page.get_by_text("Polls answered").locator("xpath=preceding-sibling::p")).to_have_text("1")
    expect(page.get_by_text("Your state").locator("xpath=preceding-sibling::p")).to_have_text("ENUGU")
    profile = page.get_by_role("region", name="Profile")
    expect(profile).to_contain_text(citizen.email)
    expect(profile).to_contain_text("Citizen")

    waiting = page.get_by_role("region", name="Live polls waiting for you")
    expect(waiting).not_to_contain_text(COST_OF_LIVING)
    live = [p for p in api("GET", "/polls")[1] if p["status"] == "active" and p["id"] != poll["id"]]
    expect(waiting.get_by_role("listitem")).to_have_count(min(4, len(live)))
    expect(page.get_by_text("Live polls waiting").locator("xpath=preceding-sibling::p")).to_have_text(str(len(live)))

    recent = page.get_by_role("region", name="Recent activity")
    expect(recent.get_by_role("listitem")).to_have_count(1)
    expect(recent.get_by_role("link", name="Results so far")).to_have_attribute("href", f"/results/{poll['id']}")

    # Tabs: the arrow keys move between the routes, as on the static page
    tab = page.get_by_role("tab", name="Overview")
    tab.focus()
    page.keyboard.press("ArrowRight")
    expect(page).to_have_url(app_url + "/dashboard/history")
    expect(page.get_by_role("tab", name="Participation history")).to_be_focused()

    history = page.get_by_role("region", name="Participation history")
    expect(history).to_contain_text("1 poll answered · 1 still live · newest first")
    expect(history).to_contain_text(COST_OF_LIVING)
    history.get_by_role("button", name="Closed").click()
    expect(history.get_by_role("button", name="Closed")).to_have_attribute("aria-pressed", "true")
    expect(history).to_contain_text("No closed polls in your history.")
    expect(page.get_by_role("note")).to_contain_text("How you answered is never shown here or anywhere else")


def test_a_revoked_session_is_signed_out(page: Page, app_url, citizen, console_errors):
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/dashboard")
    expect(page.get_by_role("heading", level=1)).to_have_text("Welcome back, Ngozi")
    # Signing out everywhere (decision 0010) revokes this browser's session too
    assert api("POST", "/auth/logout", token=citizen.token)[0] == 204
    page.reload()
    expect(page.get_by_role("main").get_by_text("Sign in to see your dashboard")).to_be_visible()
    expect(page.get_by_role("navigation").get_by_role("link", name="Sign in")).to_be_visible()


def test_old_links_land_on_the_new_routes(page: Page, app_url, citizen):
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/dashboard.html#history")
    expect(page).to_have_url(app_url + "/dashboard/history")
    expect(page.get_by_role("tab", name="Participation history")).to_have_attribute("aria-selected", "true")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, citizen, path):
    """Ported word for word (D48): the static panel's visible text is on the new page"""
    respond(citizen, seeded(COST_OF_LIVING))
    sign_in(page, citizen)
    page.goto(SITE + PAGES[path])
    panel = page.locator(".dash-page .results-panel:not([hidden])")
    expect(panel).to_have_count(1)
    old = [" ".join(t.split()) for t in panel.locator(".results-card-label, .results-card-sub, dt, p, .dash-filter-btn")
           .filter(visible=True).all_inner_texts()]
    head = [" ".join(t.split()) for t in page.locator(".page-head").locator("h1, p, .ph-stat-label").all_inner_texts()]
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + path)
    expect(page.get_by_role("tabpanel")).to_be_visible()
    new = " ".join(page.locator("main").inner_text().split())
    assert [t for t in old + head if t and t.lower() not in new.lower()] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_and_no_horizontal_scroll(page: Page, app_url, citizen, path, width):
    respond(citizen, seeded(COST_OF_LIVING))
    sign_in_with_cookie(page, app_url, citizen)
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    wait_for_page(page)
    expect(page.get_by_role("tabpanel")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth") <= width
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
               for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []


def test_axe_signed_out(page: Page, app_url):
    page.goto(app_url + "/dashboard")
    expect(page.get_by_role("main").get_by_text("Sign in to see your dashboard")).to_be_visible()
    violations = axe.run(page).response["violations"]
    assert [v["id"] for v in violations if v["impact"] in ("serious", "critical")] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_page_screenshots(page: Page, app_url, citizen, path, width):
    """Current and new view, full length, for the owner's sign-off on the PR (D48)"""
    respond(citizen, seeded(COST_OF_LIVING))
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    name = path.strip("/").replace("/", "-")
    sign_in(page, citizen)
    sign_in_with_cookie(page, app_url, citizen)
    for label, url in [("current", SITE + PAGES[path]), ("new", app_url + path)]:
        page.goto(url)
        wait_for_page(page)
        expect(page.locator("h1")).to_contain_text("Welcome back")
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")
