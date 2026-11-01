"""Security headers and the per-request CSP on the new frontend (Milestone 9, decision 0028, D66).

Every page carries a Content-Security-Policy whose script nonce changes on each request, and
the pages still work under it: they hydrate, draw Chart.js charts and sign in, with no
violation reported. /api/* keeps FastAPI's own headers."""

from playwright.sync_api import Page, expect

from test_frontend_pages import OUTLOOK, seeded, sign_in_with_cookie

# Collects CSP violations from the moment each document starts
WATCH_VIOLATIONS = """
window.__cspViolations = [];
document.addEventListener('securitypolicyviolation', e =>
  window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
"""


def csp_of(page: Page, url: str) -> str:
    res = page.request.get(url)
    assert res.status == 200, url
    return res.headers["content-security-policy"]


def test_pages_send_security_headers_with_a_fresh_nonce(page: Page, app_url):
    res = page.request.get(app_url + "/about")
    headers = res.headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert "'strict-dynamic'" in headers["content-security-policy"]
    assert csp_of(page, app_url + "/about") != csp_of(page, app_url + "/about")


def test_api_responses_keep_fastapis_headers(page: Page, app_url):
    res = page.request.get(app_url + "/api/health")
    assert res.status == 200
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_pages_work_under_the_policy(page: Page, app_url, admin, console_errors):
    page.add_init_script(WATCH_VIOLATIONS)
    # Hydrated: the ticker goes live only once React runs
    page.goto(app_url + "/")
    expect(page.get_by_test_id("ticker")).to_have_attribute("data-state", "live")
    # Chart.js, loaded lazily, draws on its canvas
    page.goto(f"{app_url}/results/{seeded(OUTLOOK)['id']}")
    page.wait_for_function("() => { const c = document.querySelector('canvas'); return c && c.width > 0 && "
                           "c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v) }")
    assert page.evaluate("window.__cspViolations") == []
    # Signed in as an admin, the overview renders
    sign_in_with_cookie(page, app_url, admin)
    page.goto(app_url + "/admin")
    expect(page.get_by_role("heading", level=1)).to_be_visible()
    expect(page.get_by_test_id("ticker")).to_have_attribute("data-state", "live")
    assert page.evaluate("window.__cspViolations") == []
