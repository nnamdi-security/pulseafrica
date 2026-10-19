from tests.conftest import register_and_login
from tests.test_polls import create_poll, submit


def test_stats_on_empty_database(client):
    assert client.get("/api/stats").json() == {
        "activePolls": 0,
        "closedPolls": 0,
        "totalResponses": 0,
        "registeredUsers": 0,
        "statesCovered": 0,
        "responsesLast7Days": 0,
        "trendingPollId": None,
        "syntheticPolls": 0,
    }


def test_stats_count_public_polls_and_responses(client, admin_headers, citizen_headers):
    busy = create_poll(client, admin_headers, title="Busy poll")
    quiet = create_poll(client, admin_headers, title="Quiet poll")
    create_poll(client, admin_headers, title="Old poll", status="closed")
    draft = create_poll(client, admin_headers, title="Draft poll", status="draft")

    other = register_and_login(client, email="emeka@example.com")
    submit(client, citizen_headers, busy, state="ENUGU STATE")
    submit(client, other, busy, state="ORLU STATE")
    submit(client, admin_headers, quiet, state="ENUGU STATE")

    stats = client.get("/api/stats").json()
    assert stats["activePolls"] == 2          # the draft isn't counted
    assert stats["closedPolls"] == 1
    assert stats["totalResponses"] == 3
    assert stats["registeredUsers"] == 3
    assert stats["statesCovered"] == 2
    assert stats["responsesLast7Days"] == 3
    assert stats["trendingPollId"] == busy["id"]
    assert draft["id"] != stats["trendingPollId"]
    assert stats["syntheticPolls"] == 0
