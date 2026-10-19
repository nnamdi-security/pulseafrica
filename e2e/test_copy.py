"""Retired claims stay retired (PRIV-02, decisions 0003 and 0007). Reads the HTML files directly."""

import re

import pytest

from conftest import ROOT

PAGES = sorted(ROOT.glob("*.html"))
# methodology.html's "anonymous response design" is methodology copy, left for METH-02 (Milestone 4).
ALLOWED = {("methodology.html", "Anonymous response design")}


def test_all_nine_pages_are_checked():
    assert len(PAGES) == 9


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_no_page_claims_anonymity(page):
    text = page.read_text()
    found = {m.group(0) for m in re.finditer(r"[^.<>]*\banonym[^.<>]*", text, re.IGNORECASE)}
    unexpected = [s.strip() for s in found if not any(page.name == f and a in s for f, a in ALLOWED)]
    assert unexpected == []


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_footer_and_ticker_say_totals_only(page):
    text = page.read_text()
    assert '<span class="badge">Totals Only</span>' in text
    assert '<span class="tick-val">Published as totals only</span>' in text
    assert "never linked" not in text.lower()
