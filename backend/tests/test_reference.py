from app.core.constants import AGE_RANGES, EDUCATION_LEVELS, GENDERS, OCCUPATIONS, STATES
from tests.test_polls import create_poll, submit


def test_reference_lists_match_the_constants(client):
    res = client.get("/api/reference")
    assert res.status_code == 200
    assert res.json() == {
        "states": STATES,
        "ageRanges": AGE_RANGES,
        "genders": GENDERS,
        "educationLevels": EDUCATION_LEVELS,
        "occupations": OCCUPATIONS,
        "categories": [
            {"key": "presidency", "name": "Presidency"},
            {"key": "governors", "name": "Governors"},
            {"key": "economy", "name": "Economy"},
            {"key": "security", "name": "Security"},
            {"key": "education", "name": "Education"},
            {"key": "healthcare", "name": "Healthcare"},
            {"key": "governance", "name": "Governance"},
        ],
    }
    assert len(res.json()["states"]) == 40


def test_reference_is_public_and_cacheable(client, citizen_headers):
    assert client.get("/api/reference", headers=citizen_headers).status_code == 200
    assert client.get("/api/reference").headers["cache-control"] == "public, max-age=3600"


def test_every_listed_value_is_accepted(client, admin_headers):
    """The lists the pages offer are the values the API validates against."""
    ref = client.get("/api/reference").json()
    poll = create_poll(client, admin_headers, category=ref["categories"][-1]["key"])
    res = submit(
        client, admin_headers, poll,
        state=ref["states"][-1], ageRange=ref["ageRanges"][-1], gender=ref["genders"][-1],
        education=ref["educationLevels"][-1], occupation=ref["occupations"][-1],
    )
    assert res.status_code == 201
