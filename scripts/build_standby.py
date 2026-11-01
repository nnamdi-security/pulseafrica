"""Build the static pages for the Netlify rollback standby (Milestone 9, decision 0028, D60).

Copies only the static frontend (the nine pages, style.css, the three scripts, images/) into
_site/, so the host never serves backend/, docs/ or anything else in the repository, and:

- points api.js at the same origin (/api), which the host proxies to production during a
  rollback (docs/ROLLBACK.md);
- writes _site/_headers: per page, a Content-Security-Policy that allows that page's own
  inline script by its hash and only the CDNs the pages use (SEC-07), plus the headers
  frontend/ sends.

Run from the repository root:  python3 scripts/build_standby.py [output directory]
"""

import base64
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index", "polls", "poll", "results", "methodology", "about", "login", "dashboard", "admin"]
FILES = ["style.css", "api.js", "nav-auth.js", "ticker.js"]
LOCAL_API = "'http://localhost:8000/api'"

INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.S)

# Every origin the pages load from: Tabler Icons (jsDelivr, with SRI), Google Fonts (style.css),
# Chart.js on Results (cdnjs, with SRI)
STYLE_SOURCES = "'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com"
FONT_SOURCES = "'self' https://cdn.jsdelivr.net https://fonts.gstatic.com"
SCRIPT_CDN = "https://cdnjs.cloudflare.com"

COMMON_HEADERS = [
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "DENY"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"),
    ("Strict-Transport-Security", "max-age=31536000"),
]


def script_hashes(html: str) -> list[str]:
    """The CSP source of each inline script, as the browser hashes it (the exact text between the tags)"""
    return ["'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'"
            for body in INLINE_SCRIPT.findall(html)]


def page_policy(html: str) -> str:
    scripts = " ".join(["'self'", *script_hashes(html), SCRIPT_CDN])
    return "; ".join([
        "default-src 'self'",
        f"script-src {scripts}",
        f"style-src {STYLE_SOURCES}",
        f"font-src {FONT_SOURCES}",
        "img-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


def headers_file(policies: dict[str, str]) -> str:
    blocks = ["/*\n" + "".join(f"  {name}: {value}\n" for name, value in COMMON_HEADERS)]
    for page, policy in policies.items():
        paths = [f"/{page}.html", f"/{page}"] + (["/"] if page == "index" else [])
        for path in paths:
            blocks.append(f"{path}\n  Content-Security-Policy: {policy}\n")
    return "\n".join(blocks)


def build(out: Path) -> dict[str, str]:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    policies = {}
    for page in PAGES:
        html = (ROOT / f"{page}.html").read_text(encoding="utf-8")
        (out / f"{page}.html").write_text(html, encoding="utf-8")
        policies[page] = page_policy(html)
    for name in FILES:
        shutil.copy2(ROOT / name, out / name)
    shutil.copytree(ROOT / "images", out / "images")

    api = (out / "api.js").read_text(encoding="utf-8")
    if LOCAL_API not in api:
        sys.exit("api.js no longer defaults to " + LOCAL_API + "; update scripts/build_standby.py")
    (out / "api.js").write_text(api.replace(LOCAL_API, "'/api'", 1), encoding="utf-8")

    (out / "_headers").write_text(headers_file(policies), encoding="utf-8")
    return policies


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"
    build(target)
    print(f"Built the standby into {target}")
