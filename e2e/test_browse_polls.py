"""Journey 1: browse, filter and search polls."""

import re

from playwright.sync_api import Page, expect

BORDER = "Border security and internal displacement — Q1 report"
OUTLOOK = "Q1 2026 economic outlook — citizen confidence index"
PRESIDENT = "Presidential performance — Q2 2026 mid-term assessment"


def titles(page: Page):
    return page.locator("#pollsGrid .poll-card-title")


def test_browse_filter_and_search(page: Page, console_errors):
    page.goto("/polls.html")
    expect(page.locator("#resultsCount")).to_contain_text(re.compile(r"Showing \d+ polls"))
    expect(page.locator("#pollsGrid")).to_have_attribute("aria-busy", "false")
    expect(page.get_by_role("note").filter(has_text="Demonstration data")).to_be_visible()
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(1)

    page.get_by_role("searchbox", name="Search polls").fill("border")
    expect(titles(page)).to_have_text([BORDER])

    page.get_by_role("searchbox", name="Search polls").fill("no poll has this title")
    expect(page.locator("#pollsGrid")).to_contain_text("No polls match these filters.")

    page.get_by_role("searchbox", name="Search polls").fill("")
    page.get_by_role("group", name="Filter by status").get_by_role("button", name="Closed").click()
    expect(titles(page).filter(has_text=BORDER)).to_have_count(1)
    expect(titles(page).filter(has_text=OUTLOOK)).to_have_count(1)
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(0)

    page.get_by_role("group", name="Filter by status").get_by_role("button", name="All polls").click()
    page.locator(".filter-btn[data-category='security']").click()
    expect(titles(page).filter(has_text=BORDER)).to_have_count(1)
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(0)
