"""Journey 6 on frontend/ (Milestone 8): the admin gate and the Overview. The polls, the editor and
users follow in the next PRs (decision 0026)."""

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, api, sign_in
from test_frontend_pages import sign_in_with_cookie, wait_for_page
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# The new routes, with the static view each replaces
PAGES = {"/admin": "/admin.html"}


def stat(page: Page, label: str):
    return page.get_by_text(label, exact=True).locator("xpath=preceding-sibling::p")


def test_signed_out_visitors_are_asked_to_sign_in_and_come_back(page: Page, app_url, admin, console_errors):
    page.goto(app_url + "/admin")
    main = page.get_by_role("main")
    expect(main.get_by_text("Sign in as an admin")).to_be_visible()
    expect(page.get_by_role("tablist")).to_have_count(0)

    main.get_by_role("link", name="Sign in").click()
    expect(page).to_have_url(app_url + "/login?next=/admin")
    form = page.get_by_role("form", name="Sign in")
    form.get_by_label("Email address").fill(admin.email)
    form.get_by_label("Password", exact=True).fill(admin.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page).to_have_url(app_url + "/admin")
    expect(page.get_by_role("tab", name="Overview")).to_have_attribute("aria-selected", "true")


def test_citizens_are_kept_out(page: Page, app_url, citizen, console_errors):
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/admin")
    main = page.get_by_role("main")
    expect(main.get_by_text("Admin access only")).to_be_visible()
    expect(main.get_by_role("link", name="Go to your dashboard")).to_have_attribute("href", "/dashboard")
    expect(page.get_by_role("tablist")).to_have_count(0)
    expect(page.get_by_role("region", name="Platform totals")).to_have_count(0)


def test_overview_shows_the_apis_figures(page: Page, app_url, admin, console_errors):
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin")
    expect(page.get_by_role("heading", level=1)).to_have_text("Admin dashboard")
    expect(page.get_by_role("tablist", name="Admin sections").get_by_role("tab")).to_have_text(["Overview", "Polls", "Users"])
    expect(page.get_by_role("region", name="Platform totals")).to_be_visible()
    o = api("GET", "/admin/overview", token=admin.token)[1]

    expect(stat(page, "Total users")).to_have_text(f"{o['totalUsers']:,}")
    expect(stat(page, "Total polls")).to_have_text(f"{o['totalPolls']:,}")
    expect(stat(page, "Active polls")).to_have_text(f"{o['activePolls']:,}")
    expect(stat(page, "Responses, last 7 days")).to_have_text(f"{o['responsesLast7Days']:,}")

    totals = page.get_by_role("region", name="Platform totals")
    for label, key in [("Suspended", "suspendedUsers"), ("Drafts", "draftPolls"), ("All time", "totalResponses")]:
        expect(totals.get_by_text(label, exact=True).locator("xpath=following-sibling::strong")).to_have_text(f"{o[key]:,}")

    daily = page.get_by_role("region", name="Responses per day · last 14 days")
    columns = daily.locator("[data-tip]")
    expect(columns).to_have_count(14)
    columns.last.focus()
    expect(columns.last).to_be_focused()
    expect(daily.get_by_role("table")).to_be_hidden()
    daily.get_by_text("Show as table").click()
    expect(daily.get_by_role("row")).to_have_count(15)

    part = page.get_by_role("region", name="Participation by poll")
    rows = part.get_by_role("row")
    expect(rows).to_have_count(len(o["polls"]) + 1)
    first = o["polls"][0]
    expect(rows.nth(1)).to_contain_text(first["title"])
    expect(rows.nth(1).get_by_role("link")).to_have_attribute("href", f"/results/{first['id']}")


def test_old_link_lands_on_the_new_route(page: Page, app_url, admin):
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin.html")
    expect(page).to_have_url(app_url + "/admin")
    expect(page.get_by_role("tab", name="Overview")).to_have_attribute("aria-selected", "true")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, admin, path):
    """Ported word for word (D56): the static panel's visible text is on the new page"""
    sign_in(page, admin)
    page.goto(SITE + PAGES[path])
    panel = page.locator(".dash-page .results-panel:not([hidden])")
    expect(panel).to_have_count(1)
    expect(panel.locator("#partTable tr").first).to_be_visible()
    old = [" ".join(t.split()) for t in panel.locator(".results-card-label, .results-card-sub, dt, th, summary, dd span")
           .filter(visible=True).all_inner_texts()]
    head = [" ".join(t.split()) for t in page.locator(".page-head").locator(".page-head-label, h1, p, .ph-stat-label").all_inner_texts()]
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + path)
    expect(page.get_by_role("tabpanel")).to_be_visible()
    page.get_by_text("Show as table").click()
    new = " ".join(page.locator("main").inner_text().split())
    assert [t for t in old + head if t and t.lower() not in new.lower()] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_and_no_horizontal_scroll(page: Page, app_url, admin, path, width):
    sign_in_with_cookie(page, app_url, admin)
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    wait_for_page(page)
    expect(page.get_by_role("tabpanel")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth") <= width
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
               for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []


@pytest.mark.parametrize("who", ["signed-out", "citizen"])
def test_axe_on_the_gate(page: Page, app_url, citizen, who):
    if who == "citizen":
        sign_in_with_cookie(page, app_url, citizen)
    page.goto(app_url + "/admin")
    expect(page.get_by_role("main").get_by_text("Sign in as an admin" if who == "signed-out" else "Admin access only")).to_be_visible()
    violations = axe.run(page).response["violations"]
    assert [v["id"] for v in violations if v["impact"] in ("serious", "critical")] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_page_screenshots(page: Page, app_url, admin, path, width):
    """Current and new view, full length, for the owner's sign-off on the PR (D56)"""
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    name = path.strip("/").replace("/", "-")
    sign_in(page, admin)
    sign_in_with_cookie(page, app_url, admin)
    for label, url in [("current", SITE + PAGES[path]), ("new", app_url + path)]:
        page.goto(url)
        wait_for_page(page)
        expect(page.get_by_text("Platform totals", exact=True)).to_be_visible()
        expect(page.get_by_text("Total users", exact=True).locator("xpath=preceding-sibling::*")).not_to_have_text("–")
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")
