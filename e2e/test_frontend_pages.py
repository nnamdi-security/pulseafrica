"""The public pages in the new Next.js frontend (Milestone 6, decisions 0021–0023).

Each page moved from the static site gets its journeys here, run against the built app on
127.0.0.1:3000, plus axe with the contrast rule (decision 0017), a no-horizontal-scroll check,
and screenshots of the current and new page side by side for the owner's sign-off (D39)."""

import re

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page, expect

from conftest import SITE, api
from test_frontend_shell import SCREENSHOTS

axe = Axe()

# Every route Milestone 6 has moved so far, with the static page it replaces
PAGES = {
    "/": "/index.html",
    "/polls": "/polls.html",
    "/methodology": "/methodology.html",
    "/about": "/about.html",
    "/polls/1": "/poll.html?id=1",  # the seeded presidential poll, signed out
}

# Pages that decide what to show in the browser, and the heading that says they have
READY = {"/polls/1": "Sign in to take this poll"}


def wait_for_page(page: Page) -> None:
    """Live ticker and loaded fonts: the page is in its final state"""
    expect(page.locator("[data-testid=ticker], .ticker").first).to_have_attribute(
        "aria-label", re.compile("^Live platform figures"))
    page.wait_for_function("() => document.fonts.ready.then(() => true)")


def test_methodology_sections_and_jump_links(page: Page, app_url, console_errors):
    page.goto(app_url + "/methodology")
    expect(page.get_by_role("heading", level=1, name="Polling methodology")).to_be_visible()
    jump = page.get_by_role("navigation", name="Jump to section")
    names = ["What is polling?", "How polling works", "Sample collection", "Weighting (planned)", "Sample size",
             "Limitations", "What we don't do", "FAQ"]
    expect(jump.get_by_role("link")).to_have_text(names)
    expect(page.get_by_role("heading", level=2)).to_have_count(8)
    # Six questions in the FAQ, word for word from the static page (D37)
    expect(page.locator("#sec-faq h3")).to_have_count(6)

    jump.get_by_role("link", name="FAQ").click()
    expect(page).to_have_url(re.compile(r"/methodology#sec-faq$"))
    expect(page.get_by_role("heading", name="Frequently asked questions")).to_be_in_viewport()
    expect(jump.get_by_role("link", name="FAQ")).to_have_attribute("aria-current", "true")

    page.get_by_role("link", name="Participate in a poll").click()
    expect(page).to_have_url(app_url + "/polls")


def test_methodology_deep_link(page: Page, app_url):
    page.goto(app_url + "/methodology#sec-weighting")
    expect(page.get_by_role("heading", name="Weighting (planned)", level=2)).to_be_in_viewport()


def test_about_page(page: Page, app_url, console_errors):
    page.goto(app_url + "/about")
    expect(page.get_by_role("heading", level=1)).to_have_text(re.compile(r"^Data is how citizens\s*hold power accountable\.$"))
    for heading in ["What we stand for", "How PulseAfrica came to be", "The people behind the data",
                    "What we are building toward", "Be part of the record."]:
        expect(page.get_by_role("heading", level=2, name=heading)).to_be_visible()
    expect(page.get_by_role("list", name="PulseAfrica history timeline").get_by_role("listitem")).to_have_count(5)
    expect(page.get_by_role("link", name="Read our methodology")).to_have_attribute("href", "/methodology")
    expect(page.get_by_role("link", name="Participate in a poll")).to_have_attribute("href", "/polls")


@pytest.mark.parametrize("path", list(PAGES))
def test_same_copy_as_the_static_page(page: Page, app_url, path):
    """Ported word for word (D37): every heading of the static page is on the new one"""
    page.goto(SITE + PAGES[path])
    # Only what shows: poll.html keeps its other screens in the page, hidden
    old = [" ".join(t.split()) for t in page.locator("main h2, main h3, .meth-hero h1, .about-hero h1, "
                                                     "body > section h2, body > section h3").filter(visible=True)
           .all_inner_texts()]
    page.goto(app_url + path)
    # React reveals streamed content a frame after it arrives, so wait for it rather than the load event
    expect(page.locator("main h1").first).to_be_visible()
    if path in READY:
        expect(page.get_by_role("heading", name=READY[path])).to_be_visible()
    new = {" ".join(t.split()) for t in page.locator("main h1, main h2, main h3").all_inner_texts()}
    assert [h for h in old if h not in new] == []


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


@pytest.mark.parametrize("path", list(PAGES))
@pytest.mark.parametrize("width", [1280, 390])
def test_page_screenshots(page: Page, app_url, path, width):
    """Current and new page, full length, for the owner's sign-off on the PR (D39; CI keeps them as an artifact)"""
    SCREENSHOTS.mkdir(exist_ok=True)
    page.set_viewport_size({"width": width, "height": 900})
    name = path.strip("/").replace("/", "-") or "home"
    for label, url in [("current", SITE + PAGES[path]), ("new", app_url + path)]:
        page.goto(url)
        wait_for_page(page)
        page.screenshot(path=SCREENSHOTS / f"{width}-{name}-{label}.png", full_page=True, animations="disabled")


# ── Home ──

def headline(poll: dict) -> tuple[float, int] | None:
    """The first question's positive share, as ticker.js and the home page compute it"""
    options = poll["preview"]
    half = len(options) // 2
    total = sum(o["count"] for o in options)
    if not half or not total:
        return None
    return 100 * sum(o["count"] for o in options[:half]) / total, total


def test_home_figures_equal_the_api(page: Page, app_url, console_errors):
    _, stats = api("GET", "/stats")
    _, polls = api("GET", "/polls")
    live = sorted((p for p in polls if p["status"] == "active"), key=lambda p: -p["responseCount"])
    presidency = max((p for p in live if p["category"] == "presidency" and p["responseCount"]),
                     key=lambda p: p["responseCount"])
    page.goto(app_url + "/")

    strip = page.get_by_role("region", name="Platform statistics")
    expect(strip).to_contain_text(f"{stats['activePolls']}Active Polls")
    expect(strip).to_contain_text(f"{stats['statesCovered']}States Covered")
    if stats["registeredUsers"] < 1000:
        expect(strip).to_contain_text(f"{stats['registeredUsers']}Registered Voices")

    hero = page.get_by_label(f"Featured poll result: {presidency['title']}")
    share, _ = headline(presidency)
    expect(hero).to_contain_text(f"{round(share)}%")
    expect(hero).to_contain_text("Overall approval")
    _, results = api("GET", f"/results/{presidency['id']}")
    expect(hero).to_contain_text(f"Based on {results['totalResponses']:,} responses")
    expect(page.get_by_role("link", name="Participate in a Poll")).to_have_attribute("href", f"/polls/{presidency['id']}")
    expect(page.get_by_role("link", name="View Current Results")).to_have_attribute("href", f"/results/{presidency['id']}")

    featured = page.get_by_role("region", name="Featured polls").get_by_role("article")
    expect(featured.get_by_role("heading")).to_have_text([p["title"] for p in live[:3]])
    expect(featured.first.get_by_role("link", name="Take poll")).to_have_attribute("href", f"/polls/{live[0]['id']}")

    # The seed is demonstration data, and the page says so (METH-01)
    expect(page.get_by_role("note").filter(has_text="Figures on this page include simulated responses")).to_be_visible()


def test_home_category_panel_links_to_results(page: Page, app_url):
    page.goto(app_url + "/")
    panel = page.get_by_label("Headline result by category")
    expect(panel).to_contain_text("Presidency approval")
    first = panel.get_by_role("link").first
    expect(first).to_have_attribute("href", re.compile(r"^/results/\d+$"))


# ── Polls (journey 1) ──

BORDER = "Border security and internal displacement — Q1 report"
OUTLOOK = "Q1 2026 economic outlook — citizen confidence index"
PRESIDENT = "Presidential performance — Q2 2026 mid-term assessment"


def titles(page: Page):
    return page.get_by_test_id("polls-grid").get_by_role("article").get_by_role("heading")


def test_polls_browse_filter_and_search(page: Page, app_url, console_errors):
    page.goto(app_url + "/polls")
    expect(page.get_by_test_id("results-count")).to_contain_text(re.compile(r"Showing \d+ polls"))
    expect(page.get_by_test_id("polls-grid")).to_have_attribute("aria-busy", "false")
    expect(page.get_by_role("note").filter(has_text="Demonstration data")).to_be_visible()
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(1)

    search = page.get_by_role("searchbox", name="Search polls")
    search.fill("border")
    expect(titles(page)).to_have_text([BORDER])
    expect(page).to_have_url(re.compile(r"/polls\?q=border$"))

    search.fill("no poll has this title")
    expect(page.get_by_test_id("polls-grid")).to_contain_text("No polls match these filters.")

    search.fill("")
    status = page.get_by_role("group", name="Filter by status")
    status.get_by_role("button", name="Closed").click()
    expect(status.get_by_role("button", name="Closed")).to_have_attribute("aria-pressed", "true")
    expect(titles(page).filter(has_text=BORDER)).to_have_count(1)
    expect(titles(page).filter(has_text=OUTLOOK)).to_have_count(1)
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(0)
    expect(page.get_by_role("combobox", name="Filter polls by status")).to_have_value("closed")

    status.get_by_role("button", name="All polls").click()
    page.get_by_role("group", name="Filter by category").get_by_role("button", name=re.compile("^Security")).click()
    expect(page).to_have_url(re.compile(r"/polls\?category=security$"))
    expect(titles(page).filter(has_text=BORDER)).to_have_count(1)
    expect(titles(page).filter(has_text=PRESIDENT)).to_have_count(0)


def test_polls_filters_are_shareable_and_back_undoes_them(page: Page, app_url):
    """D36: the filters live in the URL"""
    page.goto(app_url + "/polls?status=closed&sort=newest")
    expect(page.get_by_role("group", name="Filter by status").get_by_role("button", name="Closed")) \
        .to_have_attribute("aria-pressed", "true")
    expect(page.get_by_role("button", name="Newest first")).to_have_attribute("aria-pressed", "true")
    expect(titles(page)).to_have_count(2)

    page.get_by_role("group", name="Filter by status").get_by_role("button", name="All polls").click()
    expect(titles(page)).not_to_have_count(2)
    page.go_back()
    expect(page).to_have_url(re.compile(r"\?status=closed&sort=newest$"))
    expect(titles(page)).to_have_count(2)


def test_polls_counts_equal_the_api(page: Page, app_url):
    _, polls = api("GET", "/polls")
    page.goto(app_url + "/polls")
    head = page.get_by_role("region", name="Public opinion polls")
    active = sum(p["status"] == "active" for p in polls)
    expect(head).to_contain_text(f"{active}Active polls")
    expect(head).to_contain_text(f"{len(polls) - active}Closed polls")
    categories = page.get_by_role("group", name="Filter by category")
    expect(categories.get_by_role("button", name=re.compile("^All categories"))).to_contain_text(str(len(polls)))
    security = sum(p["category"] == "security" for p in polls)
    expect(categories.get_by_role("button", name=re.compile("^Security"))).to_contain_text(str(security))
    closed = next(p for p in polls if p["status"] == "closed")
    card = page.get_by_role("article").filter(has_text=closed["title"])
    expect(card.get_by_role("link", name="View results")).to_have_attribute("href", f"/results/{closed['id']}")


# ── Poll (decision 0022: the cookie session; /login arrives in Milestone 7) ──

FOREIGN_POLICY = "Foreign policy and diplomatic relations — public rating"


def seeded(title: str) -> dict:
    return next(p for p in api("GET", "/polls")[1] if p["title"] == title)


def sign_in_with_cookie(page: Page, app_url, user) -> None:
    """What /login will do: POST /api/auth/login sets the HttpOnly session cookie"""
    res = page.request.post(app_url + "/api/auth/login", data={"email": user.email, "password": user.password},
                            headers={"X-Requested-With": "pulseafrica"})
    assert res.ok, res.text()


def test_poll_take_and_thank_you(page: Page, app_url, citizen, console_errors):
    """Journey 2 on the new page: gate, one screen per question, demographics, thank-you, then responded"""
    poll = seeded(FOREIGN_POLICY)
    page.goto(f"{app_url}/polls/{poll['id']}")
    expect(page.get_by_role("heading", level=1, name=FOREIGN_POLICY)).to_be_visible()
    expect(page.get_by_role("heading", name="Sign in to take this poll")).to_be_visible()
    expect(page.get_by_label("Poll questions").get_by_role("link", name="Sign in")).to_have_attribute(
        "href", f"/login?next=/polls/{poll['id']}")

    sign_in_with_cookie(page, app_url, citizen)
    page.reload()
    questions = api("GET", f"/polls/{poll['id']}")[1]["questions"]
    for i, question in enumerate(questions):
        main = page.get_by_label("Poll questions")
        expect(main.get_by_role("heading", name=question["text"])).to_be_visible()
        expect(main.get_by_role("button", name="Next")).to_be_disabled()
        main.get_by_role("radio").first.check()
        main.get_by_role("button", name="Next").click()

    expect(page.get_by_role("heading", name="A few details to help us weight the data accurately")).to_be_focused()
    expect(page.get_by_label("Age range")).to_have_value("25–34")
    expect(page.get_by_label("State of residence")).to_have_value("ENUGU STATE")
    page.get_by_role("button", name="Submit my response").click()
    expect(page.get_by_label("Poll questions").get_by_role("alert")).to_have_text("Please select your gender to submit.")
    page.get_by_label("Gender").select_option("Female")
    page.get_by_role("button", name="Submit my response").click()

    expect(page.get_by_role("heading", name="Response recorded. Thank you.")).to_be_focused()
    expect(page.get_by_test_id("thanks-voices")).to_have_text(f"{poll['responseCount'] + 1:,}")
    expect(page.get_by_role("link", name="View live results")).to_have_attribute("href", f"/results/{poll['id']}")
    assert api("GET", f"/polls/{poll['id']}")[1]["responseCount"] == poll["responseCount"] + 1

    page.reload()
    expect(page.get_by_role("heading", name="You’ve already responded")).to_be_visible()


def test_poll_answers_are_real_radios(page: Page, app_url, citizen):
    """FE-04 fixed: arrow keys move the choice, and Back keeps it"""
    poll = seeded("Presidential performance — Q2 2026 mid-term assessment")
    sign_in_with_cookie(page, app_url, citizen)
    page.goto(f"{app_url}/polls/{poll['id']}")
    group = page.get_by_role("radiogroup")
    group.get_by_role("radio").first.focus()
    page.keyboard.press("Space")
    page.keyboard.press("ArrowDown")
    expect(group.get_by_role("radio").nth(1)).to_be_checked()
    page.get_by_role("button", name="Next").click()
    page.get_by_role("button", name="Back").click()
    expect(page.get_by_role("radiogroup").get_by_role("radio").nth(1)).to_be_checked()


@pytest.mark.parametrize("width", [1280, 390])
def test_poll_question_screen_axe(page: Page, app_url, citizen, width):
    """The signed-in screens, which the page list (signed out) doesn't reach"""
    poll = seeded("Presidential performance — Q2 2026 mid-term assessment")
    sign_in_with_cookie(page, app_url, citizen)
    page.set_viewport_size({"width": width, "height": 900})
    page.goto(f"{app_url}/polls/{poll['id']}")
    page.get_by_role("radiogroup").get_by_role("radio").first.check()
    wait_for_page(page)
    assert page.evaluate("document.documentElement.scrollWidth") <= width
    serious = [f"{v['id']}: {[n['target'] for n in v['nodes']][:3]}"
               for v in axe.run(page).response["violations"] if v["impact"] in ("serious", "critical")]
    assert serious == []


def test_poll_closed_and_not_found(page: Page, app_url, console_errors):
    closed = next(p for p in api("GET", "/polls")[1] if p["status"] == "closed")
    page.goto(f"{app_url}/polls/{closed['id']}")
    expect(page.get_by_role("heading", name="This poll has closed")).to_be_visible()
    expect(page.get_by_role("link", name="View results")).to_have_attribute("href", f"/results/{closed['id']}")
    for path in ("/polls/999999", "/polls/abc"):
        page.goto(app_url + path)
        expect(page.get_by_role("heading", level=1, name="Poll not found")).to_be_visible()
        expect(page.get_by_role("heading", name="We couldn’t find that poll")).to_be_visible()
