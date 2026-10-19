import re
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession
from app.api.routes import admin, auth, polls, responses, results, stats
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, request_id

# SEC-07. The API only returns JSON, so its pages may load nothing and be framed by nobody.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}
API_CSP = "default-src 'none'; frame-ancestors 'none'"
HSTS = "max-age=31536000; includeSubDomains"
# Swagger UI and ReDoc load scripts and styles from a CDN, so they get no CSP (they're off in production).
DOCS_PATHS = ("/docs", "/redoc")
# A request id passed on by a proxy is kept only if it's short and plain, so it can't forge log lines.
FORWARDED_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")


def create_app(settings: Settings) -> FastAPI:
    production = settings.environment == "production"
    logger = configure_logging(settings.log_level)

    def security_headers(path: str) -> dict[str, str]:
        headers = dict(SECURITY_HEADERS)
        if not path.startswith(DOCS_PATHS):
            headers["Content-Security-Policy"] = API_CSP
        if production:
            headers["Strict-Transport-Security"] = HSTS
        return headers

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        # SEC-10: the docs map every admin endpoint, so production doesn't serve them.
        docs_url=None if production else "/docs",
        redoc_url=None if production else "/redoc",
        openapi_url=None if production else "/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        forwarded = request.headers.get("x-request-id", "")
        request_id.set(forwarded if FORWARDED_ID.fullmatch(forwarded) else uuid4().hex)
        started = perf_counter()
        response = await call_next(request)
        response.headers.update(security_headers(request.url.path))
        response.headers["X-Request-ID"] = request_id.get()
        # Method, path and status only: never query strings, headers or bodies, which can hold
        # search terms, tokens and passwords.
        logger.info("request", extra={"fields": {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "durationMs": round((perf_counter() - started) * 1000, 1),
        }})
        return response

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled error", exc_info=exc,
                     extra={"fields": {"method": request.method, "path": request.url.path, "status": 500}})
        return JSONResponse(
            {"detail": "Something went wrong on our side. Please try again."},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={**security_headers(request.url.path), "X-Request-ID": request_id.get()},
        )

    for router in (auth.router, polls.router, responses.router, results.router, stats.router, admin.router):
        app.include_router(router, prefix="/api")

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/health/ready", tags=["health"])
    def ready(db: DbSession) -> dict[str, str]:
        """For load balancers: ok only when the database answers (BE-05)."""
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError:
            logger.exception("database unavailable")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The database is unavailable"
            ) from None
        return {"status": "ok"}

    return app


app = create_app(get_settings())
