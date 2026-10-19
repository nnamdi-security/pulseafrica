"""Journey 4: register and log in, including the error cases."""

import secrets

from playwright.sync_api import Page, expect


def test_register_with_errors_then_succeed(page: Page, citizen, console_errors):
    page.goto("/login.html#register")
    form = page.locator("#register-form")
    expect(page.get_by_role("tab", name="Create account")).to_have_attribute("aria-selected", "true")

    # Nothing filled in: the form says what's missing and doesn't send anything.
    form.get_by_role("button", name="Create account").click()
    expect(page.locator("#register-alert")).to_be_visible()
    expect(form.get_by_label("Full name")).to_have_attribute("aria-invalid", "true")

    form.get_by_label("Full name").fill("Chidi Nwosu")
    form.get_by_label("Email address").fill(citizen.email)  # already registered
    form.get_by_label("State of residence").select_option("ORLU STATE")
    form.get_by_label("Age range").select_option("35–44")
    form.get_by_label("Password", exact=True).fill("secret123")
    form.get_by_label("Confirm password").fill("secret124")
    form.locator("label.auth-check").click(position={"x": 9, "y": 9})  # the tick box, as a user clicks it
    expect(form.get_by_role("checkbox")).to_be_checked()
    form.get_by_role("button", name="Create account").click()
    expect(form.get_by_label("Confirm password")).to_have_attribute("aria-invalid", "true")

    form.get_by_label("Confirm password").fill("secret123")
    form.get_by_role("button", name="Create account").click()
    # The API refuses the taken email (409) and the form marks the field.
    expect(form.get_by_label("Email address")).to_have_attribute("aria-invalid", "true")

    form.get_by_label("Email address").fill(f"chidi-{secrets.token_hex(4)}@e2e.example")
    form.get_by_role("button", name="Create account").click()
    expect(page.get_by_role("heading", name="Account created")).to_be_visible()
    expect(page.get_by_role("navigation", name="Main navigation")).to_contain_text("Chidi")


def test_login_with_a_wrong_password_then_succeed(page: Page, citizen, console_errors):
    page.goto("/login.html")
    form = page.locator("#login-form")
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill("wrong-password-1")
    form.get_by_role("button", name="Sign in").click()
    expect(page.locator("#login-alert")).to_contain_text("don’t match an account")
    expect(form.get_by_label("Password", exact=True)).to_have_value("")

    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name="You’re signed in")).to_be_visible()
    expect(page.get_by_text(f"Signed in as {citizen.email}")).to_be_visible()
