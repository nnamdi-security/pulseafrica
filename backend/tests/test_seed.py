from app.schemas.poll import PollCreate
from app.seed import POLLS, TURNOUT, drifted, seed
from tests.test_polls import create_poll


def test_seed_polls_are_valid_poll_payloads():
    for category, status, _days, title, description, questions in POLLS:
        PollCreate(
            title=title,
            description=description,
            category=category,
            status=status,
            questions=[
                {"text": text, "options": [{"text": o, "description": d} for o, d, _w in options]}
                for text, options in questions
            ],
        )


def test_every_seed_poll_has_a_turnout():
    assert len(TURNOUT) == len(POLLS)
    assert all(0 < t <= 1 for t in TURNOUT)


def test_drift_moves_weight_between_positive_and_negative_options():
    weights = [20, 30, 15, 20, 15]
    assert drifted(weights, 0.0, 0.7) == weights
    late = drifted(weights, 0.3, 1.0)   # opinion improved by the end
    assert late[0] > 20 and late[1] > 30 and late[2] == 15 and late[3] < 20 and late[4] < 15
    early = drifted(weights, 0.3, 0.0)
    assert early[0] < 20 and early[4] > 15


def test_seeded_polls_are_marked_synthetic(client, db, admin_headers):
    # METH-01: demonstration data must never pass for real research.
    seed(db, voters=5)
    real = create_poll(client, admin_headers, title="Real poll")
    assert real["isSynthetic"] is False

    polls = client.get("/api/polls").json()
    assert {p["title"]: p["isSynthetic"] for p in polls}["Real poll"] is False
    assert sum(p["isSynthetic"] for p in polls) == len(POLLS)
    seeded = next(p for p in polls if p["isSynthetic"])
    assert client.get(f"/api/polls/{seeded['id']}").json()["isSynthetic"] is True
    assert client.get(f"/api/results/{seeded['id']}").json()["isSynthetic"] is True
    assert client.get(f"/api/results/{real['id']}").json()["isSynthetic"] is False
    assert client.get("/api/stats").json()["syntheticPolls"] == len(POLLS)
