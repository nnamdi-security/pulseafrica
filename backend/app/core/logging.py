"""JSON log lines, each carrying the id of the request that produced it (BE-02)."""

import json
import logging
from contextvars import ContextVar

LOGGER_NAME = "pulseafrica"

request_id: ContextVar[str] = ContextVar("request_id", default="-")


def _with_request_id(record: logging.LogRecord) -> bool:
    record.request_id = request_id.get()  # read when logged, inside the request that logged it
    return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "requestId": getattr(record, "request_id", "-"),
            **getattr(record, "fields", {}),
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def configure_logging(level: str) -> logging.Logger:
    """The app's logger, writing JSON to stderr. Calling it again only changes the level."""
    logger = logging.getLogger(LOGGER_NAME)
    if not any(isinstance(handler.formatter, JsonFormatter) for handler in logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.addFilter(_with_request_id)
    logger.setLevel(level.upper())
    logger.propagate = False
    return logger
