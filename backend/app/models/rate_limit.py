from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RateLimitHit(Base):
    """One counted attempt at a rate-limited action (SEC-03, decision 0009). Rows older than the
    longest window are deleted as new ones arrive."""

    __tablename__ = "rate_limit_hits"
    __table_args__ = (Index("ix_rate_limit_hits_key_created_at", "key", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # "<limit name>:<address, email or user id>"
    key: Mapped[str] = mapped_column(String(320))
    # Set in Python, not by the database, so SQLite in the tests compares like-for-like values.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
