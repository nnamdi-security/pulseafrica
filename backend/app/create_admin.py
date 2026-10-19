"""Promote an existing account to admin: python -m app.create_admin you@example.com"""

import sys

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import User, UserRole


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m app.create_admin <email>")
    email = sys.argv[1].lower()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            sys.exit(f"No user with email {email}. Register through the API first.")
        user.role = UserRole.admin
        db.commit()
    print(f"{email} is now an admin.")


if __name__ == "__main__":
    main()
