"""The forms' fixed lists come from GET /api/reference (DB-03)."""

from playwright.sync_api import Page, expect

from test_take_poll import FOREIGN_POLICY, seeded_poll


def test_the_register_form_lists_every_state_and_age_range(page: Page, console_errors):
    page.goto("/login.html#register")
    state = page.get_by_label("State of residence")
    expect(state.locator("option")).to_have_count(41)          # the prompt plus 40 states
    expect(state.locator("option").nth(1)).to_have_text("ABA STATE")
    expect(page.get_by_label("Age range").locator("option")).to_have_count(7)


def test_the_poll_form_lists_every_demographic(page: Page, console_errors):
    poll = seeded_poll(FOREIGN_POLICY)
    page.goto(f"/poll.html?id={poll['id']}")
    expect(page.locator("#dem-gender option")).to_have_count(3)
    expect(page.locator("#dem-edu option")).to_have_count(7)
    expect(page.locator("#dem-occ option")).to_have_count(10)


def test_a_failed_list_says_so(page: Page):
    page.route("http://localhost:8000/api/reference", lambda route: route.abort("connectionrefused"))
    page.goto("/login.html#register")
    expect(page.get_by_label("State of residence").locator("option")).to_have_count(1)
    expect(page.get_by_label("State of residence").locator("option").first).to_have_text(
        "Couldn’t load the list. Refresh to try again.")
