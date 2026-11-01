"""Read-only smoke checks against production (Milestone 9, decision 0028, D72).

Nothing here answers a poll or changes data: production's figures stay as respondents left them."""

import re

from playwright.sync_api import Page, expect


def test_api_is_ready_and_headers_are_set(page: Page, site: str):
    ready = page.request.get(site + "/api/health/ready")
    assert ready.status == 200 and ready.json() == {"status": "ok"}
    home = page.request.get(site + "/")
    assert "'strict-dynamic'" in home.headers["content-security-policy"]
    assert home.headers["strict-transport-security"].startswith("max-age=")
    assert home.headers["x-frame-options"] == "DENY"


def test_public_pages(page: Page, site: str, page_errors):
    page.goto(site + "/")
    expect(page.get_by_test_id("ticker")).to_have_attribute("data-state", "live")
    page.goto(site + "/polls")
    first = page.get_by_role("link", name=re.compile(r"View results|View live results")).first
    expect(first).to_be_visible()
    first.click()
    expect(page).to_have_url(re.compile(r"/results/\d+$"))
    expect(page.get_by_role("heading", level=1)).to_be_visible()
    for path, heading in [("/methodology", "Polling methodology"), ("/privacy", "Privacy notice"),
                          ("/terms", "Terms of use")]:
        page.goto(site + path)
        expect(page.get_by_role("heading", level=1)).to_have_text(heading)


def test_sign_in_dashboard_and_sign_out(page: Page, site: str, account, page_errors):
    email, password = account
    page.goto(site + "/login")
    form = page.get_by_role("form", name="Sign in")
    form.get_by_label("Email address").fill(email)
    form.get_by_label("Password", exact=True).fill(password)
    form.get_by_role("button", name="Sign in").click()
    expect(page.get_by_text(f"Signed in as {email}")).to_be_visible()

    page.goto(site + "/dashboard")
    expect(page.get_by_role("heading", level=1)).to_be_visible()
    # A citizen is turned away from Admin by the API, not just the page
    page.goto(site + "/admin")
    expect(page.get_by_role("main").get_by_text("Admin access only")).to_be_visible()
    assert page.request.get(site + "/api/admin/overview").status == 403

    page.get_by_role("navigation", name="Main navigation").get_by_role("button", name="Sign out").click()
    expect(page.get_by_role("navigation", name="Main navigation").get_by_role("link", name="Sign in")).to_be_visible()
    assert page.request.get(site + "/api/auth/me").status == 401
