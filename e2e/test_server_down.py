"""Journey 7: every page that loads data says so when the API can't be reached, and offers a retry
where the page has one."""

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture
def api_down(page: Page):
    page.route("http://localhost:8000/**", lambda route: route.abort("connectionrefused"))


def test_polls_page(page: Page, api_down):
    page.goto("/polls.html")
    expect(page.locator("#pollsGrid").get_by_role("alert")).to_be_visible()
    expect(page.get_by_role("button", name="Try again")).to_be_visible()


def test_poll_page(page: Page, api_down):
    page.goto("/poll.html?id=1")
    expect(page.get_by_role("heading", name="We couldn’t load this poll")).to_be_visible()


def test_results_page(page: Page, api_down):
    page.goto("/results.html?id=1")
    expect(page.locator("#resNotice")).to_contain_text("We couldn’t")


def test_login_page(page: Page, api_down, citizen):
    page.goto("/login.html")
    form = page.locator("#login-form")
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page.locator("#login-alert")).to_be_visible()
    expect(page.locator("#login-alert")).not_to_be_empty()
