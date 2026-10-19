from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


# backend/, so backend/.env is found whichever directory the API, Alembic or a script starts from.
BACKEND_DIR = Path(__file__).resolve().parents[2]

GENERATE_SECRET = 'python -c "import secrets; print(secrets.token_urlsafe(48))"'
MIN_SECRET_BYTES = 32


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    app_name: str = "PulseAfrica API"
    # "production" turns off the API docs, adds HSTS and requires https CORS origins.
    environment: Literal["development", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    database_url: str = "postgresql+psycopg://pulseafrica:pulseafrica@localhost:5432/pulseafrica"

    jwt_secret_key: str  # required: there is deliberately no default
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5500", "http://127.0.0.1:5500"]

    @model_validator(mode="before")
    @classmethod
    def require_secret(cls, data: Any) -> Any:
        if isinstance(data, dict) and "jwt_secret_key" not in data:
            raise ValueError(f"JWT_SECRET_KEY is not set. Generate one with: {GENERATE_SECRET}")
        return data

    @field_validator("jwt_secret_key")
    @classmethod
    def strong_secret(cls, value: str) -> str:
        if value == "change-me" or len(value.encode()) < MIN_SECRET_BYTES:
            raise ValueError(
                f"JWT_SECRET_KEY must be at least {MIN_SECRET_BYTES} bytes and not the example value. "
                f"Generate one with: {GENERATE_SECRET}"
            )
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def production_origins(self) -> "Settings":
        if self.environment == "production":
            insecure = [origin for origin in self.cors_origins if not origin.startswith("https://")]
            if insecure:
                raise ValueError(f"In production, CORS_ORIGINS must all use https. Not allowed: {', '.join(insecure)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
