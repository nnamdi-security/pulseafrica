"""Journey 3: results tabs, and the poll and question pickers. Open polls hold their breakdowns
until they close (decision 0006)."""

import re

from playwright.sync_api import Page, expect

from test_take_poll import seeded_poll

PRESIDENT = "Presidential performance — Q2 2026 mid-term assessment"
OUTLOOK = "Q1 2026 economic outlook — citizen confidence index"
HELD = "Published when this poll closes, to protect respondents’ privacy."


def open_tab(page: Page, name: str):
    page.get_by_role("tab", name=name).click()
    expect(page.get_by_role("tab", name=name)).to_have_attribute("aria-selected", "true")


def test_an_open_poll_shows_overall_results_and_holds_breakdowns(page: Page, console_errors):
    poll = seeded_poll(PRESIDENT)
    page.goto(f"/results.html?id={poll['id']}")
    expect(page.locator("#resTitle")).to_have_text(PRESIDENT)
    expect(page.locator("#statPos")).to_have_text(re.compile(r"^\d+%$"))
    expect(page.locator("#resHeldNotice")).to_contain_text("held back until it closes")
    expect(page.locator("#resHeldNotice")).to_contain_text("updated in steps of 10")

    open_tab(page, "By demographic")
    expect(page.locator("#genderBars")).to_have_text(HELD)
    open_tab(page, "By state")
    expect(page.locator("#stateHeatmap")).to_have_text(HELD)
    open_tab(page, "Trend analysis")
    expect(page.locator("#trendSub")).to_contain_text("published when this poll closes")

    # Another question of the same poll
    questions = page.get_by_label("Question")
    second = questions.locator("option").nth(1)
    questions.select_option(value=second.get_attribute("value"))
    open_tab(page, "Overview")
    expect(page.locator("#distQuestion")).to_contain_text(second.text_content().split(" · ", 1)[-1][:20])


def test_a_closed_poll_shows_its_breakdowns(page: Page, console_errors):
    president = seeded_poll(PRESIDENT)
    outlook = seeded_poll(OUTLOOK)
    page.goto(f"/results.html?id={president['id']}")
    expect(page.locator("#resTitle")).to_have_text(PRESIDENT)

    page.get_by_label("Poll", exact=True).select_option(str(outlook["id"]))
    expect(page.locator("#resTitle")).to_have_text(OUTLOOK)
    expect(page).to_have_url(re.compile(rf"results\.html\?id={outlook['id']}$"))
    expect(page.locator("#resHeldNotice")).not_to_contain_text("held back")

    open_tab(page, "By demographic")
    expect(page.locator("#genderBars .results-hbar-row").first).to_be_visible()
    expect(page.locator("#genderBars")).not_to_contain_text(HELD)
    open_tab(page, "By state")
    expect(page.locator("#stateHeatmap .state-heat-cell").first).to_be_visible()
    open_tab(page, "Trend analysis")
    expect(page.locator("#trendSub")).to_contain_text("share among the responses received each")
