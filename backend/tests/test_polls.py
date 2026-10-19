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


def test_results_breakdowns(client, admin_headers, citizen_headers):
    from tests.conftest import register_and_login

    poll = create_poll(client, admin_headers)
    submit(client, citizen_headers, poll, choice=0)
    other = register_and_login(client, email="emeka@example.com")
    submit(client, other, poll, choice=1, gender="Male", state="ORLU STATE")
    submit(client, admin_headers, poll, choice=0, gender="Male", state="ENUGU STATE")

    res = client.get(f"/api/results/{poll['id']}")
    assert res.status_code == 200
    body = res.json()
    assert body["totalResponses"] == 3

    economy = body["questions"][0]
    assert [(o["text"], o["count"], o["percent"]) for o in economy["options"]] == [
        ("Approve", 2, 66.7), ("Neutral", 1, 33.3), ("Disapprove", 0, 0.0),
    ]
    by_state = {g["group"]: [o["count"] for o in g["options"]] for g in economy["byState"]}
    assert by_state == {"ENUGU STATE": [2, 0, 0], "ORLU STATE": [0, 1, 0]}
    by_gender = {g["group"]: g["total"] for g in economy["byGender"]}
    assert by_gender == {"Female": 1, "Male": 2}


def test_results_for_poll_with_no_responses(client, admin_headers):
    poll = create_poll(client, admin_headers)
    body = client.get(f"/api/results/{poll['id']}").json()
    assert body["totalResponses"] == 0
    assert all(o["percent"] == 0.0 for o in body["questions"][0]["options"])


def test_list_includes_counts_and_preview(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    submit(client, citizen_headers, poll, choice=0)
    submit(client, admin_headers, poll, choice=1)

    [card] = client.get("/api/polls").json()
    assert card["responseCount"] == 2
    assert card["questionCount"] == 2
    assert [(o["text"], o["count"], o["percent"]) for o in card["preview"]] == [
        ("Approve", 1, 50.0), ("Neutral", 1, 50.0), ("Disapprove", 0, 0.0),
    ]


def test_preview_with_no_responses(client, admin_headers):
    create_poll(client, admin_headers)
    [card] = client.get("/api/polls").json()
    assert card["responseCount"] == 0
    assert [o["percent"] for o in card["preview"]] == [0.0, 0.0, 0.0]


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


def test_results_optional_demographics_and_trend(client, admin_headers, citizen_headers):
    poll = create_poll(client, admin_headers)
    submit(client, citizen_headers, poll, choice=0, education="Postgraduate", occupation="Student")
    submit(client, admin_headers, poll, choice=1)  # no education / occupation

    economy = client.get(f"/api/results/{poll['id']}").json()["questions"][0]
    assert [(g["group"], g["total"]) for g in economy["byEducation"]] == [("Postgraduate", 1)]
    assert [(g["group"], g["total"]) for g in economy["byOccupation"]] == [("Student", 1)]

    [today] = economy["trend"]
    assert len(today["date"]) == 10 and today["date"][4] == "-"
    assert today["total"] == 2
    assert [o["count"] for o in today["options"]] == [1, 1, 0]
