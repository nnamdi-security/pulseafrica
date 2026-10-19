import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from app.db.session import get_db
from app.main import app
from app.models import Poll
from tests.conftest import TestingSession, engine, make_citizens, register_and_login

POLL_PAYLOAD = {
    "title": "Presidential approval — Q4",
    "description": "How is President Okonkwo doing?",
    "category": "presidency",
    "status": "active",
    "questions": [
        {
            "text": "Do you approve of the President's handling of the economy?",
            "options": [{"text": "Approve"}, {"text": "Neutral"}, {"text": "Disapprove"}],
        },
        {
            "text": "Do you feel safe in your state?",
            "options": [{"text": "Yes"}, {"text": "No"}],
        },
    ],
}


def create_poll(client, admin_headers, **overrides):
    res = client.post("/api/polls", json={**POLL_PAYLOAD, **overrides}, headers=admin_headers)
    assert res.status_code == 201, res.text
    return res.json()


def close(client, admin_headers, poll):
    """Close the poll, which releases its breakdowns and trend (decision 0006)."""
    res = client.patch(f"/api/polls/{poll['id']}", json={"status": "closed"}, headers=admin_headers)
    assert res.status_code == 200, res.text


def answers_for(poll, choice=0):
    return [{"questionId": q["id"], "optionId": q["options"][choice]["id"]} for q in poll["questions"]]


def submit(client, headers, poll, choice=0, **demographics):
    payload = {
        "pollId": poll["id"],
        "ageRange": "25–34",
        "gender": "Female",
        "state": "ENUGU STATE",
        "answers": answers_for(poll, choice),
        **demographics,
    }
    return client.post("/api/responses", json=payload, headers=headers)


def test_only_admins_create_polls(client, citizen_headers):
    assert client.post("/api/polls", json=POLL_PAYLOAD).status_code == 401
    assert client.post("/api/polls", json=POLL_PAYLOAD, headers=citizen_headers).status_code == 403


def test_create_and_get_poll(client, admin_headers):
    poll = create_poll(client, admin_headers)
    res = client.get(f"/api/polls/{poll['id']}")
    assert res.status_code == 200
    body = res.json()
    assert [q["text"] for q in body["questions"]] == [q["text"] for q in POLL_PAYLOAD["questions"]]
    assert [o["text"] for o in body["questions"][0]["options"]] == ["Approve", "Neutral", "Disapprove"]


def test_drafts_hidden_from_public(client, admin_headers):
    draft = create_poll(client, admin_headers, status="draft", title="Draft poll")
    create_poll(client, admin_headers)
    assert [p["title"] for p in client.get("/api/polls").json()] == [POLL_PAYLOAD["title"]]
    assert client.get(f"/api/polls/{draft['id']}").status_code == 404
    assert len(client.get("/api/polls", headers=admin_headers).json()) == 2


def test_list_filters(client, admin_headers):
    create_poll(client, admin_headers)
    create_poll(client, admin_headers, title="School funding", category="education", status="closed")
    assert [p["title"] for p in client.get("/api/polls?category=education").json()] == ["School funding"]
    assert [p["title"] for p in client.get("/api/polls?status=closed").json()] == ["School funding"]
    assert [p["title"] for p in client.get("/api/polls?search=school").json()] == ["School funding"]


def test_submit_response_once(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    assert submit(client, citizen_headers, poll).status_code == 201
    assert submit(client, citizen_headers, poll).status_code == 409


def test_submit_requires_login(client, admin_headers):
    poll = create_poll(client, admin_headers)
    assert submit(client, {}, poll).status_code == 401


def test_submit_rejects_bad_answers(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    payload = {"pollId": poll["id"], "ageRange": "25–34", "gender": "Female", "state": "ENUGU STATE"}

    missing = {**payload, "answers": answers_for(poll)[:1]}
    assert client.post("/api/responses", json=missing, headers=citizen_headers).status_code == 422

    q1, q2 = poll["questions"]
    wrong_option = {**payload, "answers": [
        {"questionId": q1["id"], "optionId": q2["options"][0]["id"]},
        {"questionId": q2["id"], "optionId": q2["options"][0]["id"]},
    ]}
    assert client.post("/api/responses", json=wrong_option, headers=citizen_headers).status_code == 422


def test_closed_poll_rejects_responses(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers, status="closed")
    assert submit(client, citizen_headers, poll).status_code == 409


def test_results_breakdowns(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    people = iter(make_citizens(db, 30))
    for _ in range(10):
        submit(client, next(people), poll, choice=0)
        submit(client, next(people), poll, choice=1, gender="Male", state="ORLU STATE")
        submit(client, next(people), poll, choice=0, gender="Male", state="ENUGU STATE")
    close(client, admin_headers, poll)

    res = client.get(f"/api/results/{poll['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["totalResponses"] == 30

    economy = body["questions"][0]
    assert [(o["text"], o["count"], o["percent"]) for o in economy["options"]] == [
        ("Approve", 20, 66.7), ("Neutral", 10, 33.3), ("Disapprove", 0, 0.0),
    ]
    by_state = {g["group"]: [o["count"] for o in g["options"]] for g in economy["byState"]}
    assert by_state == {"ENUGU STATE": [20, 0, 0], "ORLU STATE": [0, 10, 0]}
    by_gender = {g["group"]: g["total"] for g in economy["byGender"]}
    assert by_gender == {"Female": 10, "Male": 20}


def test_results_for_poll_with_no_responses(client, admin_headers):
    poll = create_poll(client, admin_headers)
    body = client.get(f"/api/results/{poll['id']}").json()
    assert body["totalResponses"] == 0
    assert body["resultsWithheld"] is True
    assert all(o["percent"] is None for o in body["questions"][0]["options"])


def test_list_includes_counts_and_preview(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    for i, headers in enumerate(make_citizens(db, 10)):
        submit(client, headers, poll, choice=i % 2)

    [card] = client.get("/api/polls").json()
    assert card["responseCount"] == 10
    assert card["questionCount"] == 2
    assert [(o["text"], o["count"], o["percent"]) for o in card["preview"]] == [
        ("Approve", 5, 50.0), ("Neutral", 5, 50.0), ("Disapprove", 0, 0.0),
    ]


def test_preview_with_no_responses(client, admin_headers):
    create_poll(client, admin_headers)
    [card] = client.get("/api/polls").json()
    assert card["responseCount"] == 0
    assert card["preview"] == []


def test_has_responded(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    url = f"/api/polls/{poll['id']}"
    assert client.get(url).json()["hasResponded"] is None
    assert client.get(url, headers=citizen_headers).json()["hasResponded"] is False
    submit(client, citizen_headers, poll)
    body = client.get(url, headers=citizen_headers).json()
    assert body["hasResponded"] is True
    assert body["responseCount"] == 1


def test_create_poll_rejects_unknown_category(client, admin_headers):
    res = client.post("/api/polls", json={**POLL_PAYLOAD, "category": "sports"}, headers=admin_headers)
    assert res.status_code == 422


def test_optional_demographics(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    assert submit(client, citizen_headers, poll, education="Postgraduate", occupation="Nurse").status_code == 422
    assert submit(client, citizen_headers, poll, education="Bachelor's degree", occupation="Student").status_code == 201


def test_results_optional_demographics_and_trend(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    people = iter(make_citizens(db, 20))
    for _ in range(10):
        submit(client, next(people), poll, choice=0, education="Postgraduate", occupation="Student")
        submit(client, next(people), poll, choice=1)  # no education / occupation
    close(client, admin_headers, poll)

    body = client.get(f"/api/results/{poll['id']}").json()
    economy = body["questions"][0]
    assert [(g["group"], g["total"]) for g in economy["byEducation"]] == [("Postgraduate", 10)]
    assert [(g["group"], g["total"]) for g in economy["byOccupation"]] == [("Student", 10)]

    assert body["trendInterval"] == "day"
    [today] = economy["trend"]
    assert len(today["date"]) == 10 and today["date"][4] == "-"
    assert today["total"] == 20
    assert [o["count"] for o in today["options"]] == [10, 10, 0]


def _move_closing_date(db, poll, delta):
    # The API won't set a past closing date on an active poll, so move it directly.
    row = db.get(Poll, poll["id"])
    row.closes_at = datetime.now(timezone.utc) + delta
    db.commit()


def test_responses_refused_once_the_closing_date_has_passed(client, db, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    other = register_and_login(client, email="other@example.com")
    assert submit(client, other, poll).status_code == 201
    before = client.get(f"/api/results/{poll['id']}").json()

    _move_closing_date(db, poll, timedelta(seconds=-1))
    res = submit(client, citizen_headers, poll)
    assert res.status_code == 409
    assert res.json() == {"detail": "This poll is closed"}
    after = client.get(f"/api/results/{poll['id']}").json()
    assert after["breakdownsHeld"] is False  # closed, so breakdowns are released (decision 0006)
    assert {**after, "breakdownsHeld": True} == before


def test_responses_accepted_before_the_closing_date(client, db, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    _move_closing_date(db, poll, timedelta(minutes=1))
    assert submit(client, citizen_headers, poll).status_code == 201
    assert client.get(f"/api/results/{poll['id']}").json()["totalResponses"] == 1


@pytest.mark.skipif(engine.dialect.name == "sqlite", reason="needs a real database with concurrent sessions")
def test_simultaneous_duplicate_submissions_store_one_response(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)

    # Each request gets its own session, and both wait at the barrier until they have passed every
    # check and are about to insert, so only the unique constraint can stop the second one.
    barrier = threading.Barrier(2, timeout=10)
    sessions = []

    def own_session():
        session = TestingSession()
        sessions.append(session)
        event.listen(session, "before_flush", lambda *_: barrier.wait())
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = own_session
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = sorted(pool.map(lambda _: submit(client, citizen_headers, poll).status_code, range(2)))

    assert codes == [201, 409]
    assert len(sessions) == 2
    assert client.get(f"/api/results/{poll['id']}").json()["totalResponses"] == 1


def test_a_poll_past_its_closing_date_reports_closed(client, db, admin_headers, citizen_headers):
    # Decision INT-01a: an active poll whose closing date has passed shows as closed everywhere.
    due = create_poll(client, admin_headers, title="Past due")
    live = create_poll(client, admin_headers, title="Still open")
    submit(client, citizen_headers, due)
    _move_closing_date(db, due, timedelta(seconds=-1))
    _move_closing_date(db, live, timedelta(minutes=1))

    statuses = {p["title"]: p["status"] for p in client.get("/api/polls").json()}
    assert statuses == {"Past due": "closed", "Still open": "active"}
    assert client.get(f"/api/polls/{due['id']}").json()["status"] == "closed"
    assert [p["title"] for p in client.get("/api/polls?status=closed").json()] == ["Past due"]
    assert [p["title"] for p in client.get("/api/polls?status=active").json()] == ["Still open"]

    stats = client.get("/api/stats").json()
    assert (stats["activePolls"], stats["closedPolls"]) == (1, 1)
    assert stats["trendingPollId"] is None  # the only poll with responses has closed

    overview = client.get("/api/admin/overview", headers=admin_headers).json()
    assert (overview["activePolls"], overview["closedPolls"]) == (1, 1)
    assert {p["title"]: p["status"] for p in overview["polls"]} == statuses

    [mine] = client.get("/api/auth/me/responses", headers=citizen_headers).json()
    assert mine["pollStatus"] == "closed"


def test_reopening_a_past_due_poll_needs_a_new_closing_date(client, db, admin_headers):
    poll = create_poll(client, admin_headers)
    _move_closing_date(db, poll, timedelta(seconds=-1))
    res = client.patch(f"/api/polls/{poll['id']}", json={"status": "active"}, headers=admin_headers)
    assert res.status_code == 422
    later = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    res = client.patch(f"/api/polls/{poll['id']}", json={"status": "active", "closesAt": later}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "active"
