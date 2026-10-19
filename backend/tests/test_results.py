"""Small-group suppression in public results (PRIV-01, decision 0001: k = 10)."""

import random
from datetime import datetime, timedelta, timezone

from app.core.constants import AGE_RANGES, EDUCATION_LEVELS, GENDERS, OCCUPATIONS, STATES
from app.models import Response
from tests.conftest import make_citizens
from tests.test_polls import create_poll, submit

K = 10
DIMENSIONS = ["byState", "byAgeRange", "byGender", "byEducation", "byOccupation"]


def respond(client, db, poll, groups, prefix="respondent", **fixed):
    """groups: [(count, demographics)]; each respondent answers option 0 then 1 alternately."""
    headers = iter(make_citizens(db, sum(n for n, _ in groups), prefix=prefix))
    i = 0
    for count, demographics in groups:
        for _ in range(count):
            assert submit(client, next(headers), poll, choice=i % 2, **{**fixed, **demographics}).status_code == 201
            i += 1


def results(client, poll):
    res = client.get(f"/api/results/{poll['id']}")
    assert res.status_code == 200
    return res.json()


def test_a_single_respondent_in_a_state_is_not_shown(client, db, admin_headers):
    # Probe P3: one respondent in QUA STATE used to appear as its own group.
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(11, {"state": "ENUGU STATE"}), (10, {"state": "ORLU STATE"}),
                               (1, {"state": "QUA STATE"})])

    body = results(client, poll)
    question = body["questions"][0]
    # QUA STATE (1) is withheld. That would leave a remainder of 1, so the next-smallest group,
    # ORLU STATE (10), is withheld as well: the remainder is then 11 responses.
    assert [(g["group"], g["total"]) for g in question["byState"]] == [("ENUGU STATE", 11)]
    assert question["withheld"]["byState"] == {"groups": 2, "responses": 11}
    assert body["minGroupSize"] == K
    assert body["statesCovered"] == 3


def test_groups_of_k_are_shown_and_groups_of_k_minus_one_are_not(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(K, {"state": "ENUGU STATE"}), (K - 1, {"state": "ORLU STATE"}),
                               (1, {"state": "QUA STATE"})])

    question = results(client, poll)["questions"][0]
    assert [(g["group"], g["total"]) for g in question["byState"]] == [("ENUGU STATE", K)]
    assert question["withheld"]["byState"] == {"groups": 2, "responses": K}


def test_overall_counts_are_not_suppressed(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(12, {"state": "ENUGU STATE"}), (1, {"state": "QUA STATE"})])

    body = results(client, poll)
    assert body["totalResponses"] == 13
    assert body["resultsWithheld"] is False
    economy = body["questions"][0]
    assert economy["total"] == 13
    assert [(o["text"], o["count"], o["percent"]) for o in economy["options"]] == [
        ("Approve", 7, 53.8), ("Neutral", 6, 46.2), ("Disapprove", 0, 0.0),
    ]
    # Showing ENUGU STATE (12) would reveal QUA STATE's one answer by subtraction.
    assert economy["byState"] == []
    assert economy["withheld"]["byState"] == {"groups": 2, "responses": 13}


def test_skipped_optional_questions_count_as_not_shown(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(10, {"education": "Postgraduate"}), (3, {})])

    question = results(client, poll)["questions"][0]
    # 3 people skipped the education question; showing Postgraduate (10) would reveal their answers.
    assert question["byEducation"] == []
    assert question["withheld"]["byEducation"] == {"groups": 1, "responses": 13}


def test_polls_under_k_responses_hide_their_percentages(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(K - 1, {})])

    body = results(client, poll)
    assert body["totalResponses"] == K - 1
    assert body["resultsWithheld"] is True
    for question in body["questions"]:
        assert question["total"] == K - 1
        # Option names still come through, so the page can list them
        assert [o["optionId"] for o in question["options"]] == [
            o["id"] for q in poll["questions"] if q["id"] == question["questionId"] for o in q["options"]
        ]
        assert all(o["count"] is None and o["percent"] is None for o in question["options"])
        assert all(question[d] == [] for d in DIMENSIONS)
        assert question["trend"] == []
        assert question["withheld"]["trend"] == {"groups": 1, "responses": K - 1}

    [card] = client.get("/api/polls").json()
    assert card["responseCount"] == K - 1
    assert card["preview"] == []
    assert client.get(f"/api/polls/{poll['id']}").json()["preview"] == []


def test_polls_with_k_responses_show_their_percentages(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(K, {})])

    body = results(client, poll)
    assert body["resultsWithheld"] is False
    assert [o["count"] for o in body["questions"][0]["options"]] == [5, 5, 0]
    assert [(g["group"], g["total"]) for g in body["questions"][0]["byState"]] == [("ENUGU STATE", K)]
    [card] = client.get("/api/polls").json()
    assert [(o["text"], o["count"], o["percent"]) for o in card["preview"]] == [
        ("Approve", 5, 50.0), ("Neutral", 5, 50.0), ("Disapprove", 0, 0.0),
    ]


def _set_response_dates(db, poll, dates):
    """Give the poll's responses these creation times, in submission order."""
    rows = db.query(Response).filter_by(poll_id=poll["id"]).order_by(Response.id).all()
    assert len(rows) == len(dates)
    for row, created in zip(rows, dates):
        row.created_at = created
    db.commit()


def test_trend_withholds_small_days(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(26, {})])
    day = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)
    _set_response_dates(db, poll, [day] * 12 + [day + timedelta(days=1)] * 11 + [day + timedelta(days=2)] * 3)

    body = results(client, poll)
    assert body["trendInterval"] == "day"
    question = body["questions"][0]
    # The 3 responses on the last day are withheld, and so is the next-smallest day (11).
    assert [(p["date"], p["total"]) for p in question["trend"]] == [("2026-10-05", 12)]
    assert question["withheld"]["trend"] == {"groups": 2, "responses": 14}


def test_long_polls_group_the_trend_by_week_or_month(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(20, {})])
    start = datetime(2026, 6, 3, 9, tzinfo=timezone.utc)  # a Wednesday

    _set_response_dates(db, poll, [start] * 10 + [start + timedelta(days=60)] * 10)
    body = results(client, poll)
    assert body["trendInterval"] == "week"
    # Each period starts on its Monday
    assert [(p["date"], p["total"]) for p in body["questions"][0]["trend"]] == [
        ("2026-06-01", 10), ("2026-07-27", 10),
    ]

    _set_response_dates(db, poll, [start] * 10 + [start + timedelta(days=200)] * 10)
    body = results(client, poll)
    assert body["trendInterval"] == "month"
    assert [(p["date"], p["total"]) for p in body["questions"][0]["trend"]] == [
        ("2026-06-01", 10), ("2026-12-01", 10),
    ]


def test_nothing_can_be_recovered_by_subtraction(client, db, admin_headers):
    """For every question and breakdown, overall minus the visible groups is 0 or at least k,
    and every visible group has at least k responses."""
    poll = create_poll(client, admin_headers)
    rng = random.Random(7)
    states = STATES[:6]
    headers = make_citizens(db, 120)
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    for h in headers:
        demographics = {
            "state": rng.choice(states),
            "ageRange": rng.choice(AGE_RANGES),
            "gender": rng.choice(GENDERS),
        }
        if rng.random() < 0.7:
            demographics["education"] = rng.choice(EDUCATION_LEVELS)
        if rng.random() < 0.6:
            demographics["occupation"] = rng.choice(OCCUPATIONS)
        assert submit(client, h, poll, choice=rng.randrange(2), **demographics).status_code == 201
    _set_response_dates(db, poll, [start + timedelta(hours=rng.randrange(14 * 24)) for _ in headers])

    body = results(client, poll)
    assert body["totalResponses"] == 120
    for question in body["questions"]:
        for name in DIMENSIONS + ["trend"]:
            groups = question[name]
            assert all(g["total"] >= K for g in groups), name
            residual = question["total"] - sum(g["total"] for g in groups)
            assert residual == 0 or residual >= K, (name, residual)
            assert question["withheld"][name]["responses"] == residual
        # Suppression decisions don't depend on the question, since everyone answers every question.
        assert [g["group"] for g in question["byState"]] == [g["group"] for g in body["questions"][0]["byState"]]


def test_a_trend_with_only_small_days_is_grouped_by_week(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    respond(client, db, poll, [(20, {})])
    monday = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)
    # Two responses a day on weekdays for two weeks: no single day reaches 10, but each week does.
    days = [monday + timedelta(days=week * 7 + weekday) for week in range(2) for weekday in range(5)]
    _set_response_dates(db, poll, [d for d in days for _ in range(2)])

    body = results(client, poll)
    assert body["trendInterval"] == "week"
    assert [(p["date"], p["total"]) for p in body["questions"][0]["trend"]] == [
        ("2026-10-05", 10), ("2026-10-12", 10),
    ]
