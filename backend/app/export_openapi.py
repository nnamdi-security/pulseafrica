"""Print the API's OpenAPI schema as JSON, without starting a server or opening a database.

The Next.js frontend generates its TypeScript types from it (decision 0016):

    python -m app.export_openapi > schema.json

Settings still come from the environment or backend/.env. If no JWT_SECRET_KEY is set, a
throwaway one is used: nothing is signed, and the schema doesn't depend on it.
"""

import json
import os
import secrets
import sys


def main() -> None:
    os.environ.setdefault("JWT_SECRET_KEY", secrets.token_urlsafe(48))
    from app.main import app  # imported here so the throwaway secret is in place first

    json.dump(app.openapi(), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
