"""Logout failures must stay visible and retryable on both frontends."""

import pytest
from playwright.sync_api import Page, expect

from conftest import SITE, api, sign_in
from test_frontend_shell import sign_in_with_cookie


@pytest.mark.parametrize("frontend", ["primary", "legacy"])
@pytest.mark.parametrize("width", [1280, 390])
@pytest.mark.parametrize("failure", ["network", "server"])
def test_logout_failure_then_retry(page: Page, app_url, citizen, console_errors, frontend, width, failure):
    page.set_viewport_size({"width": width, "height": 900})
    if frontend == "primary":
        sign_in_with_cookie(page, app_url, citizen)
        page.goto(app_url + "/about")
    else:
        sign_in(page, citizen)
        page.goto(SITE + "/about.html")

    nav = page.get_by_role("navigation", name="Main navigation")
    if width == 390:
        nav.get_by_role("button", name="Open navigation menu").click()
    button = nav.get_by_role("button", name="Sign out")
    expect(button).to_be_visible()

    def refuse(route):
        if failure == "network":
            route.abort("connectionrefused")
        else:
            route.fulfill(status=500, content_type="application/json", body='{"detail":"Unavailable"}')

    page.route("**/api/auth/logout", refuse)
    button.focus()
    page.keyboard.press("Enter")
    alert = nav.get_by_role("alert")
    expect(alert).to_have_text("Sign out failed. Please try again.")
    expect(alert).to_be_visible()
    expect(button).to_be_enabled()
    expect(button).to_be_focused()
    expect(nav.get_by_role("link", name="Sign in", exact=True)).to_have_count(0)
    assert api("GET", "/auth/me", token=citizen.token)[0] == 200
    assert alert.evaluate("el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")

    page.unroute("**/api/auth/logout", refuse)
    with page.expect_response(lambda response: response.url.endswith("/api/auth/logout")) as logout:
        page.keyboard.press("Enter")
    assert logout.value.status == 204
    expect(nav.get_by_role("link", name="Sign in", exact=True)).to_be_focused()
    expect(alert).to_have_count(0)
    assert api("GET", "/auth/me", token=citizen.token)[0] == 401
