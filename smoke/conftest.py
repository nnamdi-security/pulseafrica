import os
import re

import pytest


@pytest.fixture(scope="session")
def site() -> str:
    url = os.environ.get("SMOKE_URL", "").rstrip("/")
    # https only, except a local run of the same checks (http://127.0.0.1 or http://localhost)
    if not (url.startswith("https://") or re.match(r"^http://(127\.0\.0\.1|localhost)(:\d+)?$", url)):
        pytest.exit("Set SMOKE_URL to the deployed site's https address (see README.md).", returncode=4)
    return url


@pytest.fixture(scope="session")
def account() -> tuple[str, str]:
    email, password = os.environ.get("SMOKE_EMAIL"), os.environ.get("SMOKE_PASSWORD")
    if not (email and password):
        pytest.exit("Set SMOKE_EMAIL and SMOKE_PASSWORD (a citizen account kept for this test).", returncode=4)
    return email, password


@pytest.fixture
def page_errors(page):
    """Fails the test if a page logs a JavaScript error"""
    errors: list[str] = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    yield errors
    assert errors == []
