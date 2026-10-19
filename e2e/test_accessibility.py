"""axe checks on all 9 pages. Serious and critical violations fail the run, except the known
colour-contrast failures (FE-03), which wait on decision D7 and are recorded in docs/TESTING.md."""

import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page

from conftest import sign_in
from test_take_poll import seeded_poll

PRESIDENT = "Presidential performance — Q2 2026 mid-term assessment"
KNOWN = {"color-contrast"}  # FE-03

axe = Axe()


def serious_violations(page: Page, path: str) -> list[str]:
    page.goto("/" + path)
    page.wait_for_load_state("networkidle")
    violations = axe.run(page).response["violations"]
    return [
        f"{v['id']} ({v['impact']}): {[n['target'] for n in v['nodes']][:3]}"
        for v in violations
        if v["impact"] in ("serious", "critical") and v["id"] not in KNOWN
    ]


@pytest.mark.parametrize("path", ["index.html", "polls.html", "poll.html?id={id}", "results.html?id={id}",
                                  "methodology.html", "about.html", "login.html", "login.html#register"])
def test_public_pages(page: Page, path):
    assert serious_violations(page, path.format(id=seeded_poll(PRESIDENT)["id"])) == []


def test_poll_questions_signed_in(page: Page, citizen):
    sign_in(page, citizen)
    assert serious_violations(page, f"poll.html?id={seeded_poll(PRESIDENT)['id']}") == []


@pytest.mark.parametrize("path", ["dashboard.html", "dashboard.html#history", "dashboard.html#settings",
                                  "admin.html", "admin.html#polls", "admin.html#users"])
def test_account_pages(page: Page, admin, path):
    sign_in(page, admin)
    assert serious_violations(page, path) == []
