"""Login, Register and the reset notice in the new Next.js frontend (Milestone 7, decisions 0024–0025).

The journeys of test_register_and_login.py on /login and /register, signed in by the API's HttpOnly
cookie only, plus the `next` round trip, "Keep me signed in", old links, axe and screenshots (D48)."""

import re
import secrets
from urllib.parse import quote

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, api
from test_frontend_pages import seeded, wait_for_page
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# The new routes, with the static view each replaces
PAGES = {"/login": "/login.html", "/register": "/login.html#register", "/login/reset": "/login.html#reset"}

FOREIGN_POLICY = "Foreign policy and diplomatic relations — public rating"


def session_cookie(page: Page) -> dict | None:
    return next((c for c in page.context.cookies() if c["name"] == "pa_session"), None)


def alert(page: Page):
    """The form's banner (Next.js keeps its own empty route announcer, also role=alert)"""
    return page.get_by_role("main").get_by_role("alert")


def sign_in_form(page: Page):
    return page.get_by_role("form", name="Sign in")


def test_register_with_errors_then_succeed(page: Page, app_url, citizen, console_errors):
    page.goto(app_url + "/register")
    form = page.get_by_role("form", name="Create account")
    expect(page.get_by_role("tab", name="Create account")).to_have_attribute("aria-selected", "true")

    # Nothing filled in: the form says what's missing and sends nothing
    form.get_by_role("button", name="Create account").click()
    expect(alert(page)).to_have_text("Please fix the 7 highlighted fields below.")
    expect(form.get_by_label("Full name")).to_have_attribute("aria-invalid", "true")
    expect(form.get_by_label("Full name")).to_be_focused()

    form.get_by_label("Full name").fill("Chidi Nwosu")
    form.get_by_label("Email address").fill(citizen.email)  # already registered
    form.get_by_label("State of residence").select_option("ORLU STATE")
    form.get_by_label("Age range").select_option("35–44")
    form.get_by_label("Password", exact=True).fill("secret123")
    form.get_by_label("Confirm password").fill("secret124")
    form.get_by_text("I am 18 or older").click(position={"x": 4, "y": 4})  # the box, not the Terms link
    expect(form.get_by_role("checkbox")).to_be_checked()
    form.get_by_role("button", name="Create account").click()
    expect(form.get_by_label("Confirm password")).to_have_attribute("aria-invalid", "true")

    form.get_by_label("Confirm password").fill("secret123")
    form.get_by_role("button", name="Create account").click()
    # The API refuses the taken email (409) and the form marks the field
    expect(form.get_by_label("Email address")).to_have_attribute("aria-invalid", "true")
    expect(form.get_by_label("Email address")).to_be_focused()

    form.get_by_label("Email address").fill(f"chidi-{secrets.token_hex(4)}@e2e.example")
    form.get_by_role("button", name="Create account").click()
    expect(page.get_by_role("heading", name="Account created")).to_be_focused()
    expect(page.get_by_role("navigation", name="Main navigation")).to_contain_text("Chidi")
    # Signed in for this browser session only, as login.html does
    assert session_cookie(page)["expires"] == -1


def test_taken_email_offers_sign_in_with_it(page: Page, app_url, citizen, console_errors):
    page.goto(app_url + "/register")
    form = page.get_by_role("form", name="Create account")
    form.get_by_label("Full name").fill("Chidi Nwosu")
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("State of residence").select_option("ORLU STATE")
    form.get_by_label("Age range").select_option("35–44")
    form.get_by_label("Password", exact=True).fill("secret123")
    form.get_by_label("Confirm password").fill("secret123")
    form.get_by_text("I am 18 or older").click(position={"x": 4, "y": 4})  # the box, not the Terms link
    form.get_by_role("button", name="Create account").click()

    form.get_by_role("link", name="Sign in instead").click()
    expect(page).to_have_url(app_url + "/login")
    expect(sign_in_form(page).get_by_label("Email address")).to_have_value(citizen.email)
    expect(sign_in_form(page).get_by_label("Password", exact=True)).to_be_focused()


def test_login_with_a_wrong_password_then_succeed(page: Page, app_url, citizen, console_errors):
    page.goto(app_url + "/login")
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill("wrong-password-1")
    form.get_by_role("button", name="Sign in").click()
    expect(alert(page)).to_contain_text("don’t match an account")
    expect(form.get_by_label("Password", exact=True)).to_have_value("")
    expect(form.get_by_label("Password", exact=True)).to_be_focused()

    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name="You’re signed in")).to_be_visible()
    expect(page.get_by_text(f"Signed in as {citizen.email}")).to_be_visible()
    live = sum(p["status"] == "active" for p in api("GET", "/polls")[1])
    expect(page.get_by_text(f"There are {live} live polls waiting for your response.")).to_be_visible()
    expect(page).to_have_title("Success — PulseAfrica")


def test_no_token_is_readable_by_javascript(page: Page, app_url, citizen):
    """SEC-04 fixed here: the session is an HttpOnly cookie scoped to /api, and nothing is stored"""
    page.goto(app_url + "/login")
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    with page.expect_request(lambda req: req.url.endswith("/api/auth/login")) as login:
        form.get_by_role("button", name="Sign in").click()
    assert login.value.headers.get("x-requested-with") == "pulseafrica"
    expect(page.get_by_role("heading", name="You’re signed in")).to_be_visible()

    cookie = session_cookie(page)
    assert cookie["httpOnly"] and cookie["path"] == "/api" and cookie["sameSite"] == "Lax"
    stored = page.evaluate("""() => ({
        cookie: document.cookie,
        local: Object.keys(localStorage).map(k => localStorage.getItem(k)).join(' '),
        session: Object.keys(sessionStorage).map(k => sessionStorage.getItem(k)).join(' '),
    })""")
    assert cookie["value"] not in " ".join(stored.values())
    assert "pa_session" not in stored["cookie"]


@pytest.mark.parametrize("remember", [True, False])
def test_keep_me_signed_in_sets_the_cookie_lifetime(page: Page, app_url, citizen, remember):
    """D45: ticked, the cookie outlives the browser session for as long as the token; unticked, it doesn't"""
    page.goto(app_url + "/login")
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    if remember:
        form.get_by_text("Keep me signed in on this device").click()
    form.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name="You’re signed in")).to_be_visible()
    expires = session_cookie(page)["expires"]
    if remember:
        assert 50 * 60 < expires - page.evaluate("Date.now() / 1000") <= 60 * 60
    else:
        assert expires == -1


def test_poll_gate_sign_in_returns_to_the_poll(page: Page, app_url, citizen, console_errors):
    """The `next` round trip: the poll's gate → /login?next=/polls/N → back on the poll, signed in"""
    poll = seeded(FOREIGN_POLICY)
    page.goto(f"{app_url}/polls/{poll['id']}")
    page.get_by_label("Poll questions").get_by_role("link", name="Sign in").click()
    expect(page).to_have_url(f"{app_url}/login?next=/polls/{poll['id']}")
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page).to_have_url(f"{app_url}/polls/{poll['id']}")
    question = api("GET", f"/polls/{poll['id']}")[1]["questions"][0]["text"]
    expect(page.get_by_label("Poll questions").get_by_role("heading", name=question)).to_be_visible()


def test_poll_gate_create_account_returns_to_the_poll(page: Page, app_url, console_errors):
    poll = seeded(FOREIGN_POLICY)
    page.goto(f"{app_url}/polls/{poll['id']}")
    page.get_by_label("Poll questions").get_by_role("link", name="Create account").click()
    expect(page).to_have_url(f"{app_url}/register?next=/polls/{poll['id']}")
    # The tab to Sign in keeps where to go next
    expect(page.get_by_role("tab", name="Sign in")).to_have_attribute("href", f"/login?next={quote('/polls/' + str(poll['id']), safe='')}")
    form = page.get_by_role("form", name="Create account")
    form.get_by_label("Full name").fill("Amaka Obi")
    form.get_by_label("Email address").fill(f"amaka-{secrets.token_hex(4)}@e2e.example")
    form.get_by_label("State of residence").select_option("ENUGU STATE")
    form.get_by_label("Age range").select_option("25–34")
    form.get_by_label("Password", exact=True).fill("secret123")
    form.get_by_label("Confirm password").fill("secret123")
    form.get_by_text("I am 18 or older").click(position={"x": 4, "y": 4})  # the box, not the Terms link
    form.get_by_role("button", name="Create account").click()
    expect(page).to_have_url(f"{app_url}/polls/{poll['id']}")
    expect(page.get_by_role("navigation", name="Main navigation")).to_contain_text("Amaka")


@pytest.mark.parametrize("bad", ["//evil.example", "https://evil.example/", "/\\evil.example"])
def test_next_never_leaves_the_site(page: Page, app_url, citizen, bad):
    page.goto(f"{app_url}/login?next={quote(bad, safe='')}")
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page.get_by_role("heading", name="You’re signed in")).to_be_visible()
    assert page.url.startswith(app_url + "/login")


def test_old_links_land_on_the_new_views(page: Page, app_url, citizen):
    page.goto(app_url + "/login.html#register")
    expect(page).to_have_url(app_url + "/register")
    expect(page.get_by_role("heading", name="Create your account")).to_be_visible()

    page.goto(app_url + "/login.html#reset")
    expect(page).to_have_url(app_url + "/login/reset")
    expect(page.get_by_role("heading", name="Reset your password")).to_be_visible()

    # An old sign-in link from a poll still returns to that poll
    page.goto(app_url + "/login.html?next=" + quote("poll.html?id=1", safe=""))
    form = sign_in_form(page)
    form.get_by_label("Email address").fill(citizen.email)
    form.get_by_label("Password", exact=True).fill(citizen.password)
    form.get_by_role("button", name="Sign in").click()
    expect(page).to_have_url(app_url + "/polls/1")


def test_view_links_move_focus(page: Page, app_url, console_errors):
    page.goto(app_url + "/login")
    page.get_by_role("link", name="Forgot password?").click()
    expect(page.get_by_role("heading", name="Reset your password")).to_be_focused()
    expect(page.get_by_role("tablist")).to_have_count(0)
    page.get_by_role("link", name="Back to sign in").click()
    expect(sign_in_form(page).get_by_label("Email address")).to_be_focused()
    page.get_by_role("link", name="Create an account").click()
    expect(page.get_by_role("form", name="Create account").get_by_label("Full name")).to_be_focused()
    # Arrow keys move between the tabs, as on login.html
    page.get_by_role("tab", name="Create account").focus()
    page.keyboard.press("ArrowLeft")
    expect(page).to_have_url(app_url + "/login")
    expect(page.get_by_role("tab", name="Sign in")).to_be_focused()


def test_trust_panel_shows_the_platforms_figures(page: Page, app_url):
    stats = api("GET", "/stats")[1]
    page.goto(app_url + "/login")
    panel = page.get_by_role("complementary", name="Why create an account")
    for value, label in [(stats["registeredUsers"], "Registered voices"), (stats["statesCovered"], "States covered"),
                         (stats["activePolls"], "Live polls")]:
        expect(panel).to_contain_text(f"{value:,}{label}")
    # The static page shows the same figures now (decision 0025)
    page.goto(SITE + "/login.html")
    expect(page.locator("[data-aside-stat=registeredUsers]")).to_have_text(f"{stats['registeredUsers']:,}")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, path):
    """Ported word for word (D48): the static view's visible text is on the new page"""
    page.goto(SITE + PAGES[path])
    view = page.locator(".auth-view:not([hidden])")
    expect(view).to_have_count(1)
    old = [" ".join(t.split()) for t in view.locator("h2, p, label, li").filter(visible=True).all_inner_texts()]
    aside = [" ".join(t.split()) for t in page.locator(".auth-aside").locator("h1, h2, p").all_inner_texts()]
    page.goto(app_url + path)
    expect(page.locator("main h2").first).to_be_visible()
    new = " ".join(page.locator("main").inner_text().split())
    assert [t for t in old + aside if t and t not in new] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_axe_and_no_horizontal_scroll(page: Page, app_url, path, width):
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(app_url + path)
    wait_for_page(page)
    assert page.evaluate("document.documentElement.scrollWidth") <= width
    violations = axe.run(page).response["violations"]
    serious = [f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
               for v in violations if v["impact"] in ("serious", "critical")]
    assert serious == []


def test_axe_with_errors_showing(page: Page, app_url):
    page.goto(app_url + "/register")
    page.get_by_role("button", name="Create account").click()
    expect(alert(page)).to_be_visible()
    violations = axe.run(page).response["violations"]
    assert [v["id"] for v in violations if v["impact"] in ("serious", "critical")] == []


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_page_screenshots(page: Page, app_url, path, width):
    """Current and new view, full length, for the owner's sign-off on the PR (D48)"""
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    name = path.strip("/").replace("/", "-")
    for label, url in [("current", SITE + PAGES[path]), ("new", app_url + path)]:
        page.goto(url)
        wait_for_page(page)
        stats = page.locator(".auth-aside-stats, [aria-label='Why create an account'] .mt-auto")
        expect(stats).not_to_contain_text("–")
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")
