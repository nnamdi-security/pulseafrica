from app.schemas.poll import PollCreate
from app.seed import POLLS, TURNOUT, drifted


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
