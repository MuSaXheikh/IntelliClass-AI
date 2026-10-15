"""Logging setup. Use `logging.getLogger(__name__)`; never `print`."""

import logging
import re


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once with a compact format."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    # One line per Supabase Storage request is noise at INFO; errors still surface.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    # Defence in depth: a bearer token in a query string must never reach the access log.
    access = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, _RedactTokens) for f in access.filters):
        access.addFilter(_RedactTokens())


class _RedactTokens(logging.Filter):
    _pattern = re.compile(r"(token=)[^&\s\"']+")

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args:
            record.args = tuple(
                self._pattern.sub(r"\1***", a) if isinstance(a, str) else a for a in record.args
            )
        record.msg = self._pattern.sub(r"\1***", str(record.msg))
        return True
