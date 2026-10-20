"""Retired claims stay retired (PRIV-02, METH-02; decisions 0003, 0007 and 0013). Reads the HTML files directly."""

import re

import pytest

from conftest import ROOT

PAGES = sorted(ROOT.glob("*.html"))
ALLOWED: set[tuple[str, str]] = set()


def test_all_nine_pages_are_checked():
    assert len(PAGES) == 9


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_no_page_claims_anonymity(page):
    # crossorigin="anonymous" on the CDN tags (decision 0012) is an HTML attribute, not copy.
    text = page.read_text().replace('crossorigin="anonymous"', "")
    found = {m.group(0) for m in re.finditer(r"[^.<>]*\banonym[^.<>]*", text, re.IGNORECASE)}
    unexpected = [s.strip() for s in found if not any(page.name == f and a in s for f, a in ALLOWED)]
    assert unexpected == []


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_footer_and_ticker_say_totals_only(page):
    text = page.read_text()
    assert '<span class="badge">Totals Only</span>' in text
    assert '<span class="tick-val">Published as totals only</span>' in text
    assert "never linked" not in text.lower()


# METH-02 (decision 0013): research claims the code doesn't support.
RETIRED_METHODOLOGY = [
    "results are weighted", "statistically weighted", "apply post-stratification", "weight aggressively",
    "includes a margin of error", "&plusmn;", "±", "min. sample per poll", "stratified to match",
    "verified email", "verified registered accounts", "update in real time", "ip level", "ip-level",
    "weighting factors applied", "every weighting factor",
]


@pytest.mark.parametrize("page", [ROOT / name for name in ("index.html", "methodology.html", "about.html")],
                         ids=lambda p: p.name)
def test_no_unsupported_methodology_claims(page):
    text = " ".join(page.read_text().lower().split())
    assert [claim for claim in RETIRED_METHODOLOGY if claim in text] == []


# The same checks on the pages moved to frontend/ (Milestone 6)
NEW_PAGES = sorted((ROOT / "frontend" / "src" / "app").rglob("page.tsx"))


@pytest.mark.parametrize("page", NEW_PAGES, ids=lambda p: str(p.relative_to(ROOT / "frontend" / "src" / "app")))
def test_new_pages_make_no_retired_claims(page):
    text = " ".join(page.read_text().lower().split())
    assert "anonym" not in text
    assert "never linked" not in text
    assert [claim for claim in RETIRED_METHODOLOGY if claim in text] == []
