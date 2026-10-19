from app.schemas.poll import PollCreate
from app.seed import POLLS, TURNOUT


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
