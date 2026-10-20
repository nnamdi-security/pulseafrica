"""Journey 6 on frontend/ (Milestone 8): the admin gate, the Overview, the poll list and the poll
editor. Users follow in the next PR (decision 0026)."""

import secrets

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, api, sign_in
from test_frontend_pages import sign_in_with_cookie, wait_for_page
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# The new routes, with the static view each replaces
PAGES = {"/admin": "/admin.html", "/admin/polls": "/admin.html#polls", "/admin/polls/new": "/admin.html#polls"}
NEW_POLL = "/admin/polls/new"


def open_static(page: Page, path: str):
    """The static view a route replaces, in its final state; returns the part that was moved"""
    page.goto(SITE + PAGES[path])
    if path == "/admin":
        expect(page.locator("#partTable tr").first).to_be_visible()
        return page.locator("#panel-overview")
    expect(page.locator("#pollTable tr").first).to_be_visible()
    if path == NEW_POLL:
        page.get_by_role("button", name="New poll").click()
        expect(page.get_by_role("heading", name="New poll")).to_be_focused()
        return page.locator("#pollEditorView")
    return page.locator("#pollListView")


def open_new(page: Page, app_url: str, path: str):
    page.goto(app_url + path)
    if path == NEW_POLL:
        expect(page.get_by_role("heading", name="New poll")).to_be_focused()
        expect(page.get_by_label("Category").locator("option")).not_to_have_count(1)
    else:
        expect(page.get_by_role("tabpanel").get_by_role("row").nth(1)).to_be_visible()


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


def test_poll_lifecycle(page: Page, app_url, admin, console_errors):
    """test_admin.py's journey on the new pages: create a draft, publish, close, cancelled and confirmed delete"""
    title = f"Public transport satisfaction {secrets.token_hex(3)}"
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin/polls")
    expect(page.get_by_role("tab", name="Polls")).to_have_attribute("aria-selected", "true")

    page.get_by_role("link", name="New poll").click()
    expect(page).to_have_url(app_url + "/admin/polls/new")
    expect(page.get_by_role("heading", name="New poll")).to_be_focused()
    form = page.get_by_role("form", name="New poll")
    form.get_by_label("Title").fill(title)
    form.get_by_label("Description", exact=True).fill("How satisfied are you with public transport in your state?")
    form.get_by_label("Category").select_option("governance")
    expect(form.get_by_label("Status")).to_have_value("draft")
    form.get_by_label("Question 1").fill("How satisfied are you with public transport?")
    options = form.get_by_label("Option text")
    options.nth(0).fill("Satisfied")
    options.nth(1).fill("Dissatisfied")
    form.get_by_role("button", name="Save poll").click()
    expect(page).to_have_url(app_url + "/admin/polls")
    alert = page.get_by_role("region", name="Polls").get_by_role("status")
    expect(alert).to_contain_text(f"“{title}” was created")

    row = page.get_by_role("row").filter(has_text=title)
    expect(row).to_contain_text("Draft")
    assert title not in [p["title"] for p in api("GET", "/polls")[1]]  # drafts stay hidden

    row.get_by_role("button", name="Publish").click()
    expect(alert).to_contain_text(f"“{title}” is now live.")
    assert title in [p["title"] for p in api("GET", "/polls")[1]]

    row.get_by_role("button", name="Close").click()
    expect(alert).to_contain_text(f"“{title}” is now closed.")

    page.get_by_role("button", name="Closed", exact=True).click()
    expect(page).to_have_url(app_url + "/admin/polls?status=closed")
    expect(row).to_have_count(1)
    expect(page.get_by_role("row").filter(has_text="Live")).to_have_count(0)

    row.get_by_role("button", name=f"Delete {title}").click()
    dialog = page.get_by_role("dialog", name="Delete this poll?")
    expect(dialog.get_by_role("button", name="Cancel")).to_be_focused()
    expect(dialog).to_contain_text("permanently deleted")
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()
    expect(row.get_by_role("button", name=f"Delete {title}")).to_be_focused()
    expect(row).to_have_count(1)

    row.get_by_role("button", name=f"Delete {title}").click()
    dialog.get_by_role("button", name="Delete poll").click()
    expect(alert).to_contain_text(f"“{title}” was deleted.")
    expect(row).to_have_count(0)


def test_editor_checks_fields_and_locks_answered_questions(page: Page, app_url, admin, console_errors):
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin/polls/new")
    form = page.get_by_role("form", name="New poll")
    form.get_by_role("button", name="Save poll").click()
    expect(page.get_by_role("main").get_by_role("alert")).to_have_text("Please fix the highlighted fields.")
    expect(form.get_by_label("Title")).to_be_focused()
    expect(form).to_contain_text("Choose a category.")
    expect(form).to_contain_text("Question 1 needs its text.")

    # A seeded poll that people have answered: its questions can't change
    answered = max(api("GET", "/polls")[1], key=lambda p: p["responseCount"])
    page.goto(app_url + "/admin/polls")
    page.get_by_role("row").filter(has_text=answered["title"]).get_by_role("link", name="Edit").click()
    expect(page).to_have_url(f"{app_url}/admin/polls/{answered['id']}/edit")
    form = page.get_by_role("form", name="Edit poll")
    expect(form.get_by_label("Title")).to_have_value(answered["title"])
    expect(form).to_contain_text("Questions are locked because")
    expect(form.get_by_label("Question 1")).to_be_disabled()
    expect(form.get_by_role("button", name="Add question")).to_have_count(0)
    page.get_by_role("button", name="Cancel").click()
    expect(page).to_have_url(app_url + "/admin/polls")


def test_admins_can_preview_a_drafts_results(page: Page, app_url, admin, console_errors):
    title = f"Draft preview {secrets.token_hex(3)}"
    status, draft = api("POST", "/polls", {
        "title": title, "description": "A draft to preview.", "category": "economy", "status": "draft",
        "questions": [{"text": "How is the economy doing?", "options": [{"text": "Well"}, {"text": "Badly"}]}],
    }, token=admin.token)
    assert status == 201, draft
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin/polls?status=draft")
    page.get_by_role("row").filter(has_text=title).get_by_role("link", name="Results").click()
    expect(page).to_have_url(f"{app_url}/results/{draft['id']}")
    expect(page.get_by_role("heading", level=1)).to_contain_text(title)
    expect(page.get_by_text("Draft · visible to admins only")).to_be_visible()
    api("DELETE", f"/polls/{draft['id']}", token=admin.token)


def test_old_links_land_on_the_new_routes(page: Page, app_url, admin):
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin.html")
    expect(page).to_have_url(app_url + "/admin")
    expect(page.get_by_role("tab", name="Overview")).to_have_attribute("aria-selected", "true")
    page.goto(app_url + "/admin.html#polls")
    expect(page).to_have_url(app_url + "/admin/polls")
    expect(page.get_by_role("tab", name="Polls")).to_have_attribute("aria-selected", "true")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, admin, path):
    """Ported word for word (D56): the static panel's visible text is on the new page"""
    sign_in(page, admin)
    panel = open_static(page, path)
    old = [" ".join(t.split()) for t in panel.locator(
        ".results-card-label, .results-card-sub, dt, th, summary, dd span, label, legend, .auth-hint, h2, button, .dash-filter-btn")
           .filter(visible=True).all_inner_texts()]
    head = [" ".join(t.split()) for t in page.locator(".page-head").locator(".page-head-label, h1, p, .ph-stat-label").all_inner_texts()]
    sign_in_with_cookie(page, app_url, admin)
    open_new(page, app_url, path)
    if path == "/admin":
        page.get_by_text("Show as table").click()
    new = " ".join(page.locator("main").inner_text().split())
    assert [t for t in old + head if t and t.lower() not in new.lower()] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_and_no_horizontal_scroll(page: Page, app_url, admin, path, width):
    sign_in_with_cookie(page, app_url, admin)
    page.set_viewport_size({"width": width, "height": 900})
    open_new(page, app_url, path)
    wait_for_page(page)
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
    for label in ["current", "new"]:
        if label == "current":
            open_static(page, path)
        else:
            open_new(page, app_url, path)
        wait_for_page(page)
        expect(page.get_by_text("Total users", exact=True).locator("xpath=preceding-sibling::*")).not_to_have_text("–")
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")
