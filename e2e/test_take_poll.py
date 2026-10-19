"""Journey 2: take a poll: sign-in gate, ?next= return, submit, thank-you numbers,
"already responded" on reload."""

import re

from playwright.sync_api import Page, expect

from conftest import api

FOREIGN_POLICY = "Foreign policy and diplomatic relations — public rating"


def seeded_poll(title: str) -> dict:
    status, polls = api("GET", "/polls")
    assert status == 200
    return next(p for p in polls if p["title"] == title)


def test_take_a_poll(page: Page, citizen, console_errors):
    poll = seeded_poll(FOREIGN_POLICY)
    page.goto(f"/poll.html?id={poll['id']}")
    expect(page.get_by_role("heading", name="Sign in to take this poll")).to_be_visible()

    page.get_by_label("Poll questions").get_by_role("link", name="Sign in").click()
    expect(page).to_have_url(re.compile(r"login\.html\?next=poll\.html%3Fid%3D" + str(poll["id"]) + "$"))
    page.get_by_label("Email address").first.fill(citizen.email)
    page.get_by_label("Password", exact=True).first.fill(citizen.password)
    page.locator("#login-form").get_by_role("button", name="Sign in").click()
    expect(page).to_have_url(re.compile(r"/poll\.html\?id=" + str(poll["id"]) + "$"))

    # One screen per question; Next stays disabled until an answer is chosen.
    for _ in range(len(api("GET", f"/polls/{poll['id']}")[1]["questions"])):
        screen = page.locator(".poll-screen.active")
        expect(screen.get_by_role("button", name="Next")).to_be_disabled()
        screen.get_by_role("radio").first.click()
        expect(screen.get_by_role("radio").first).to_have_attribute("aria-checked", "true")
        screen.get_by_role("button", name="Next").click()

    # Age range and state come from the account; gender is asked.
    expect(page.get_by_label("Age range")).to_have_value("25–34")
    expect(page.get_by_label("State of residence")).to_have_value("ENUGU STATE")
    page.get_by_label("Gender").select_option("Female")
    page.get_by_role("button", name="Submit my response").click()

    expect(page.get_by_role("heading", name="Response recorded. Thank you.")).to_be_visible()
    expect(page.locator("#thanksVoices")).to_have_text(f"{poll['responseCount'] + 1:,}")
    expect(page.get_by_role("link", name="View live results")).to_have_attribute(
        "href", f"results.html?id={poll['id']}"
    )

    page.reload()
    expect(page.get_by_role("heading", name="You’ve already responded")).to_be_visible()
