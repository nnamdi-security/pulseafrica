"""CDN files carry integrity hashes and still load (SEC-08, decision 0012).

A wrong hash makes the browser refuse the file silently, so these check the files were applied:
the icon stylesheet's rules are readable, and Chart.js defined its global."""

import pytest
from playwright.sync_api import Page

from test_accessibility import PRESIDENT
from test_take_poll import seeded_poll

PAGES = ["index.html", "polls.html", "poll.html", "results.html", "methodology.html", "about.html",
         "login.html", "dashboard.html", "admin.html"]

# Reading a cross-origin sheet's rules throws unless it loaded with CORS and passed its hash.
ICONS_LOADED = """() => [...document.styleSheets].some(sheet => {
    if (!sheet.href || !sheet.href.includes('tabler-icons')) return false;
    try { return sheet.cssRules.length > 0; } catch (e) { return false; }
})"""


@pytest.mark.parametrize("path", PAGES)
def test_icon_stylesheet_has_a_hash_and_loads(page: Page, path):
    page.goto("/" + path)
    link = page.locator('link[href*="tabler-icons"]')
    assert link.get_attribute("integrity").startswith("sha384-")
    assert link.get_attribute("crossorigin") == "anonymous"
    page.wait_for_function(ICONS_LOADED)


def test_chart_js_has_a_hash_and_loads(page: Page):
    page.goto(f"/results.html?id={seeded_poll(PRESIDENT)['id']}")
    script = page.locator('script[src*="chart.umd.js"]')
    assert script.get_attribute("integrity").startswith("sha384-")
    assert script.get_attribute("crossorigin") == "anonymous"
    page.wait_for_function("() => typeof window.Chart === 'function'")
