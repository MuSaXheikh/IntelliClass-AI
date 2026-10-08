"""Logging setup. Use `logging.getLogger(__name__)`; never `print`."""

import logging


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once with a compact format."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
