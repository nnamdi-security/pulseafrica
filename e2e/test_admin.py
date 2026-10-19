"""Journey 6: admin: create, publish, close and delete a poll; suspend, reactivate, promote and
demote a user. Every destructive step goes through the confirmation dialog."""

import secrets

from playwright.sync_api import Page, expect

from conftest import api, sign_in


def test_poll_lifecycle(page: Page, admin, console_errors):
    title = f"Public transport satisfaction {secrets.token_hex(3)}"
    sign_in(page, admin)
    page.goto("/admin.html#polls")
    expect(page.get_by_role("tab", name="Polls")).to_have_attribute("aria-selected", "true")

    page.get_by_role("button", name="New poll").click()
    expect(page.get_by_role("heading", name="New poll")).to_be_focused()
    form = page.locator("#poll-form")
    form.get_by_label("Title").fill(title)
    form.get_by_label("Description", exact=True).fill("How satisfied are you with public transport in your state?")
    form.get_by_label("Category").select_option("governance")
    expect(form.get_by_label("Status")).to_have_value("draft")
    form.locator(".admin-question-text").fill("How satisfied are you with public transport?")
    options = form.get_by_label("Option text")
    options.nth(0).fill("Satisfied")
    options.nth(1).fill("Dissatisfied")
    form.get_by_role("button", name="Save poll").click()
    expect(page.locator("#polls-alert")).to_contain_text(f"“{title}” was created")

    row = page.locator("#pollTable tr").filter(has_text=title)
    expect(row).to_contain_text("Draft")
    assert title not in [p["title"] for p in api("GET", "/polls")[1]]  # drafts stay hidden

    row.get_by_role("button", name="Publish").click()
    expect(page.locator("#polls-alert")).to_contain_text(f"“{title}” is now live.")
    assert title in [p["title"] for p in api("GET", "/polls")[1]]

    row.get_by_role("button", name="Close").click()
    expect(page.locator("#polls-alert")).to_contain_text(f"“{title}” is now closed.")

    row.get_by_role("button", name=f"Delete {title}").click()
    dialog = page.get_by_role("dialog", name="Delete this poll?")
    expect(dialog).to_contain_text("permanently deleted")
    dialog.get_by_role("button", name="Cancel").click()
    expect(row).to_have_count(1)

    row.get_by_role("button", name=f"Delete {title}").click()
    page.get_by_role("dialog", name="Delete this poll?").get_by_role("button", name="Delete poll").click()
    expect(page.locator("#polls-alert")).to_contain_text(f"“{title}” was deleted.")
    expect(row).to_have_count(0)


def test_user_access(page: Page, admin, citizen, console_errors):
    sign_in(page, admin)
    page.goto("/admin.html#users")
    page.get_by_label("Search users").fill(citizen.email)
    row = page.locator("#userTable tr").filter(has_text=citizen.email)
    expect(row).to_contain_text("Citizen")

    def act(button: str, dialog_title: str, confirm: str, outcome: str):
        row.get_by_role("button", name=button).click()
        page.get_by_role("dialog", name=dialog_title).get_by_role("button", name=confirm).click()
        expect(page.locator("#users-alert")).to_contain_text(outcome)

    act("Suspend", f"Suspend {citizen.full_name}?", "Suspend", "has been suspended.")
    expect(row).to_contain_text("Suspended")
    assert api("GET", "/auth/me", token=citizen.token)[0] == 401

    def fresh_token() -> str:
        status, body = api("POST", "/auth/login", {"email": citizen.email, "password": citizen.password})
        assert status == 200, body
        return body["accessToken"]

    act("Reactivate", f"Reactivate {citizen.full_name}?", "Reactivate", "has been reactivated.")
    # Suspension revoked the old token for good (decision 0010); signing in again works.
    assert api("GET", "/auth/me", token=citizen.token)[0] == 401
    token = fresh_token()
    assert api("GET", "/auth/me", token=token)[0] == 200

    act("Make admin", f"Make {citizen.full_name} an admin?", "Make admin", "is now an admin.")
    expect(row).to_contain_text("Admin")
    assert api("GET", "/admin/overview", token=token)[0] == 200

    act("Remove admin", f"Remove admin access from {citizen.full_name}?", "Remove admin", "is no longer an admin.")
    assert api("GET", "/admin/overview", token=token)[0] == 401
    assert api("GET", "/admin/overview", token=fresh_token())[0] == 403


def test_citizens_are_kept_out(page: Page, citizen, console_errors):
    sign_in(page, citizen)
    page.goto("/admin.html")
    expect(page.get_by_text("Admin access only")).to_be_visible()
    expect(page.get_by_role("tab", name="Polls")).to_be_hidden()
