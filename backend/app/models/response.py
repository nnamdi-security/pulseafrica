from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Response(Base):
    """One citizen's submission to one poll, with the demographics they reported."""

    __tablename__ = "responses"
    # The database itself guarantees one response per user per poll.
    __table_args__ = (UniqueConstraint("poll_id", "user_id", name="uq_response_poll_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    poll_id: Mapped[int] = mapped_column(ForeignKey("polls.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    age_range: Mapped[str] = mapped_column(String(16))
    gender: Mapped[str] = mapped_column(String(16))
    state: Mapped[str] = mapped_column(String(64))
    education: Mapped[str | None] = mapped_column(String(64))
    occupation: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    answers: Mapped[list["Answer"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (UniqueConstraint("response_id", "question_id", name="uq_answer_response_question"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    option_id: Mapped[int] = mapped_column(ForeignKey("options.id", ondelete="CASCADE"), index=True)

    response: Mapped[Response] = relationship(back_populates="answers")
