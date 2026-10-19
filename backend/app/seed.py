"""Fill an empty database with the demo polls shown on the original static pages.

    python -m app.seed                  # 10 polls + 300 demo voters' responses
    python -m app.seed --responses 0    # polls only

Demo voters get emails like voter1@demo.pulseafrica.example and an unusable
password, so nobody can sign in as them. Their answers are drawn at random,
weighted towards the percentages the static cards used to display, and spread
over the time each poll has been open with a gentle drift in opinion, so the
results page's trend charts have something to show.
"""

import argparse
import random
import secrets
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.constants import AGE_RANGES, EDUCATION_LEVELS, GENDERS, OCCUPATIONS, STATES
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Answer, Option, Poll, PollStatus, Question, Response, User

# Five-point approval scale used by the presidential poll. Weights are relative.
APPROVAL = ["Strongly approve", "Approve", "Neutral", "Disapprove", "Strongly disapprove"]


def scale(*weights):
    return [(text, "", w) for text, w in zip(APPROVAL, weights)]


# Share of demo voters who answer each poll, in POLLS order. Mirrors the
# ranking of the response counts on the original static cards.
TURNOUT = [0.95, 0.8, 0.6, 0.55, 0.5, 0.45, 0.85, 0.35, 0.3, 0.7]

# (category, status, days until close (negative = closed), title, description,
#  [(question, [(option, description, weight), ...]), ...])
POLLS = [
    ("presidency", "active", 21,
     "Presidential performance — Q2 2026 mid-term assessment",
     "Rate the President's performance across economy, security, education, healthcare, and "
     "infrastructure. The most comprehensive national leadership poll of the year.",
     [
         ("How do you rate President Simon's overall performance since taking office?", [
             ("Strongly approve", "The President is performing excellently across all areas", 20),
             ("Approve", "Generally satisfied with performance, with some reservations", 32),
             ("Neutral", "No strong opinion either way", 14),
             ("Disapprove", "Dissatisfied with performance in most areas", 20),
             ("Strongly disapprove", "Very dissatisfied — performance has been poor overall", 14),
         ]),
         ("How do you rate the government's handling of the national economy?", [
             ("Strongly approve", "Economy is well managed and improving", 12),
             ("Approve", "Generally on the right track despite some challenges", 27),
             ("Neutral", "No strong opinion on economic management", 15),
             ("Disapprove", "Economic conditions are worsening for most citizens", 26),
             ("Strongly disapprove", "Economic management has been very poor", 20),
         ]),
         ("How do you rate the government's handling of national security?", [
             ("Strongly approve", "Citizens are safe and security is well managed", 15),
             ("Approve", "Security situation is broadly acceptable", 30),
             ("Neutral", "", 13),
             ("Disapprove", "Security concerns remain high in many areas", 24),
             ("Strongly disapprove", "Security has significantly deteriorated", 18),
         ]),
         ("How do you rate the government's performance on education?", scale(17, 30, 14, 23, 16)),
         ("How do you rate the government's performance on healthcare?", scale(14, 27, 15, 25, 19)),
     ]),
    ("economy", "active", 30,
     "Cost of living — household impact survey",
     "How is your household managing rising prices? Data informs the National Economic "
     "Advisory Council report due August 2026.",
     [
         ("How is your household managing the current cost of living?", [
             ("Managing", "We can cover essentials and some savings", 31),
             ("Struggling", "Essentials are hard to afford", 69),
         ]),
         ("Compared with a year ago, your household's finances are…", [
             ("Better", "", 22), ("About the same", "", 30), ("Worse", "", 48),
         ]),
     ]),
    ("security", "active", 25,
     "Personal safety perception — state-by-state index",
     "Do you feel safer in your state this year compared to last? Results published per state "
     "with demographic breakdowns.",
     [("Do you feel safer in your state this year than last year?", [
         ("Safer", "", 45), ("Less safe", "", 55),
     ])]),
    ("education", "active", 18,
     "Public school quality — parental confidence survey",
     "Rate your satisfaction with public school access, quality of instruction, and "
     "infrastructure in your state.",
     [("How satisfied are you with public schools in your state?", [
         ("Satisfied", "", 47), ("Dissatisfied", "", 53),
     ])]),
    ("healthcare", "active", 40,
     "Access to public healthcare — national adequacy poll",
     "Do citizens have adequate access to hospitals, clinics, and essential medicines? "
     "Covers all 40 states.",
     [("Is your access to public hospitals, clinics and medicines adequate?", [
         ("Adequate", "", 41), ("Inadequate", "", 59),
     ])]),
    ("governance", "active", 35,
     "Anti-corruption confidence — trust in public institutions",
     "How much do you trust the judiciary, legislature, and civil service to act without "
     "corruption?",
     [("Do you trust public institutions to act without corruption?", [
         ("Trust", "", 28), ("Don't trust", "", 72),
     ])]),
    ("economy", "closed", -200,
     "Q1 2026 economic outlook — citizen confidence index",
     "Quarterly confidence survey on employment, inflation, and trade. Results published March 2026.",
     [("How confident are you in the economy over the next 12 months?", [
         ("Confident", "", 36), ("Not confident", "", 64),
     ])]),
    ("presidency", "active", 45,
     "Foreign policy and diplomatic relations — public rating",
     "Assess the government's handling of international partnerships, trade agreements, and "
     "regional security cooperation.",
     [("Do you approve of the government's handling of foreign policy?", [
         ("Approve", "", 49), ("Disapprove", "", 51),
     ])]),
    ("governors", "active", 28,
     "State governor performance — 40-state approval index",
     "Rate your state governor's performance on infrastructure, local security, and service "
     "delivery. All 40 states included.",
     [("How do you rate your state governor's performance?", [
         ("Approve", "", 44), ("Neutral", "", 18), ("Disapprove", "", 38),
     ])]),
    ("security", "closed", -260,
     "Border security and internal displacement — Q1 report",
     "Public perception of border management and the government's response to internally "
     "displaced communities. Closed January 2026.",
     [("Is the government's response to border security and displacement adequate?", [
         ("Adequate", "", 29), ("Inadequate", "", 71),
     ])]),
]


def drifted(weights: list[float], drift: float, t: float) -> list[float]:
    """Shift weight towards the positive (first-half) options as t goes from 0 to 1
    when drift > 0, or towards the negative (last-half) options when drift < 0."""
    n = len(weights)
    half = n // 2
    tone = [1 if i < half else -1 if i >= n - half else 0 for i in range(n)]
    shift = drift * (2 * t - 1)  # -drift at the start, +drift at the end
    return [w * max(0.05, 1 + shift * k) for w, k in zip(weights, tone)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--responses", type=int, default=300, help="number of demo voters (default 300)")
    args = parser.parse_args()

    rng = random.Random(2026)  # same demo data every run
    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Poll)):
            sys.exit("The database already has polls; seed only runs on an empty database.")

        polls = []
        for index, (category, status, days, title, description, questions) in enumerate(POLLS):
            poll = Poll(
                title=title,
                description=description,
                category=category,
                status=PollStatus(status),
                closes_at=now + timedelta(days=days),
                # Spread creation dates so "Newest first" has something to sort
                created_at=now - timedelta(days=60 - index * 5 if days > 0 else 300 - index),
                questions=[
                    Question(
                        text=text,
                        position=q_index,
                        options=[
                            Option(text=o_text, description=o_desc, position=o_index)
                            for o_index, (o_text, o_desc, _) in enumerate(options)
                        ],
                    )
                    for q_index, (text, options) in enumerate(questions)
                ],
            )
            db.add(poll)
            polls.append((poll, questions))
        db.flush()

        # Each poll's responses arrive between its creation and now (or its closing
        # date), with opinion drifting by up to ±30% over that time
        windows = []
        for poll, _ in polls:
            end = min(now, poll.closes_at)
            drift = rng.uniform(-0.3, 0.3)
            windows.append((poll.created_at, (end - poll.created_at).total_seconds(), drift))

        unusable = hash_password(secrets.token_urlsafe(32))
        for i in range(1, args.responses + 1):
            voter = User(
                full_name=f"Demo Voter {i}",
                email=f"voter{i}@demo.pulseafrica.example",
                hashed_password=unusable,
                state=rng.choice(STATES),
                age_range=rng.choice(AGE_RANGES),
                is_active=False,  # can never sign in
            )
            db.add(voter)
            db.flush()
            for (poll, questions), turnout, (start, span, drift) in zip(polls, TURNOUT, windows):
                if rng.random() > turnout:
                    continue
                t = rng.random()
                answers = []
                for question, (_, options) in zip(poll.questions, questions):
                    weights = drifted([w for _, _, w in options], drift, t)
                    option = rng.choices(question.options, weights=weights)[0]
                    answers.append(Answer(question_id=question.id, option_id=option.id))
                db.add(Response(
                    poll_id=poll.id,
                    user_id=voter.id,
                    age_range=voter.age_range,
                    gender=rng.choice(GENDERS),
                    state=voter.state,
                    education=rng.choice(EDUCATION_LEVELS),
                    occupation=rng.choice(OCCUPATIONS),
                    created_at=start + timedelta(seconds=span * t),
                    answers=answers,
                ))
        db.commit()

    print(f"Created {len(POLLS)} polls and {args.responses} demo voters.")


if __name__ == "__main__":
    main()
