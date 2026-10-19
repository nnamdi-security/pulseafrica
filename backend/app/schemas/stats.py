from app.schemas.base import CamelModel


class PlatformStats(CamelModel):
    active_polls: int
    closed_polls: int
    total_responses: int
    registered_users: int
    # Distinct states respondents have reported, out of 40
    states_covered: int
    responses_last_7_days: int
    # The live poll with the most responses in the last 7 days (None if there were none)
    trending_poll_id: int | None
