# The PulseAfrica API (docs/DEPLOYMENT.md, decision 0028).
# Build from backend/:  docker build -t pulseafrica-api .
# Configuration comes only from environment variables; .env files are never copied in.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

RUN useradd --system --no-create-home --uid 10001 api
USER api

# PORT may be set by the platform. Uvicorn's own proxy-header handling stays off: it would
# replace the peer address with one read from X-Forwarded-For, and the rate limits already
# read that header themselves, trusting only TRUSTED_PROXIES (app/api/ratelimit.py).
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --workers 2 --no-proxy-headers"]
