from datetime import datetime

from app.models.poll import PollStatus
from app.models.user import UserRole
from app.schemas.base import CamelModel


class DailyCount(CamelModel):
    date: str  # YYYY-MM-DD (UTC)
    count: int


class PollParticipation(CamelModel):
    id: int
    title: str
    category: str
    status: PollStatus
    closes_at: datetime | None
    response_count: int
    responses_last_7_days: int


class AdminOverview(CamelModel):
    total_users: int
    active_users: int
    suspended_users: int
    admins: int
    total_polls: int
    draft_polls: int
    active_polls: int
    closed_polls: int
    total_responses: int
    responses_last_7_days: int
    # Responses per day for the last 14 days, oldest first, including empty days
    daily_responses: list[DailyCount]
    # Every poll, drafts included, most responses first
    polls: list[PollParticipation]


class AdminUser(CamelModel):
    id: int
    full_name: str
    email: str
    state: str
    age_range: str
    role: UserRole
    is_active: bool
    created_at: datetime
    response_count: int = 0


class AdminUserPage(CamelModel):
    total: int
    items: list[AdminUser]


class AdminUserUpdate(CamelModel):
    """Fields left out are not changed."""

    is_active: bool | None = None
    role: UserRole | None = None
