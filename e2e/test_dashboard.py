"""Journey 5: dashboard: participation history, profile edit, password change, account deletion."""

from playwright.sync_api import Page, expect

from conftest import api, sign_in
from test_take_poll import seeded_poll

COST_OF_LIVING = "Cost of living — household impact survey"


def respond(user, poll):
    detail = api("GET", f"/polls/{poll['id']}")[1]
    answers = [{"questionId": q["id"], "optionId": q["options"][0]["id"]} for q in detail["questions"]]
    status, body = api("POST", "/responses", {
        "pollId": poll["id"], "ageRange": "25–34", "gender": "Male", "state": "ENUGU STATE", "answers": answers,
    }, token=user.token)
    assert status == 201, body


def test_history_profile_password_and_delete(page: Page, citizen, console_errors):
    respond(citizen, seeded_poll(COST_OF_LIVING))
    sign_in(page, citizen)

    page.goto("/dashboard.html#history")
    expect(page.get_by_role("tab", name="Participation history")).to_have_attribute("aria-selected", "true")
    expect(page.locator("#panel-history")).to_contain_text(COST_OF_LIVING)

    page.get_by_role("tab", name="Account settings").click()
    profile = page.locator("#profile-form")
    expect(profile.get_by_label("Email address")).to_have_value(citizen.email)
    profile.get_by_label("Full name").fill("Amaka Obi")
    profile.get_by_role("button", name="Save changes").click()
    expect(page.locator("#profile-alert")).to_contain_text("Your profile has been updated.")
    expect(page.locator("#dashGreeting")).to_have_text("Welcome back, Amaka")

    password = page.locator("#password-form")
    password.get_by_label("Current password").fill("not-my-password-1")
    password.get_by_label("New password", exact=True).fill("newsecret1")
    password.get_by_label("Confirm new password").fill("newsecret1")
    password.get_by_role("button", name="Change password").click()
    expect(page.locator("#pw-current-error")).to_have_text("That isn’t your current password.")
    expect(password.get_by_label("Current password")).to_be_focused()

    password.get_by_label("Current password").fill(citizen.password)
    password.get_by_label("New password", exact=True).fill("newsecret1")
    password.get_by_label("Confirm new password").fill("newsecret1")
    password.get_by_role("button", name="Change password").click()
    expect(page.locator("#password-alert")).to_contain_text("Your password has been changed.")
    assert api("POST", "/auth/login", {"email": citizen.email, "password": "newsecret1"})[0] == 200
    # The change revoked the old token (decision 0010); the page signed in again and stays signed in.
    assert api("GET", "/auth/me", token=citizen.token)[0] == 401
    expect(page.get_by_role("button", name="Sign out")).to_be_visible()

    delete = page.locator("#delete-form")
    delete.get_by_label("Enter your password to confirm").fill("newsecret1")
    delete.get_by_role("button", name="Delete my account").click()
    expect(delete.get_by_role("checkbox")).to_have_attribute("aria-invalid", "true")  # consequence not confirmed

    delete.locator("label.auth-check").click(position={"x": 9, "y": 9})  # the tick box, as a user clicks it
    expect(delete.get_by_role("checkbox")).to_be_checked()
    delete.get_by_role("button", name="Delete my account").click()
    expect(page.locator("#dashGreeting")).to_have_text("Account deleted")
    assert api("POST", "/auth/login", {"email": citizen.email, "password": "newsecret1"})[0] == 401


def test_the_dashboard_needs_a_signed_in_user(page: Page, console_errors):
    page.goto("/dashboard.html")
    expect(page.get_by_role("link", name="Sign in").last).to_be_visible()
    expect(page.locator("#dashGreeting")).not_to_contain_text("Welcome back")
