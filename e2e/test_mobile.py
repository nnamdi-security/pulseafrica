"""Journey 8: at 390px wide, no page scrolls sideways."""

import pytest
from playwright.sync_api import Page, expect

from conftest import sign_in

PUBLIC = ["index.html", "polls.html", "poll.html?id=1", "results.html?id=1", "methodology.html", "about.html",
          "login.html", "login.html#register"]
SIGNED_IN = ["dashboard.html", "dashboard.html#history", "dashboard.html#settings",
             "admin.html", "admin.html#polls", "admin.html#users"]


def page_width(page: Page) -> int:
    return page.evaluate("document.documentElement.scrollWidth")


@pytest.fixture
def phone(page: Page):
    page.set_viewport_size({"width": 390, "height": 844})
    return page


@pytest.mark.parametrize("path", PUBLIC)
def test_public_pages_fit_a_phone(phone: Page, path):
    phone.goto("/" + path)
    phone.wait_for_load_state("networkidle")
    expect(phone.locator("footer")).to_be_attached()
    assert page_width(phone) <= 390, f"{path} is {page_width(phone)}px wide"


@pytest.mark.parametrize("path", SIGNED_IN)
def test_account_pages_fit_a_phone(phone: Page, admin, path):
    sign_in(phone, admin)
    phone.goto("/" + path)
    phone.wait_for_load_state("networkidle")
    assert page_width(phone) <= 390, f"{path} is {page_width(phone)}px wide"
