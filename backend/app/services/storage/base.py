"""Object storage for rendered slide images: local disk or a private Supabase bucket."""

from typing import Protocol


class ObjectStorage(Protocol):
    """Minimal key/value blob store. Keys look like ``slides/<class_id>/<index>.png``."""

    def ensure_ready(self) -> None:
        """Create the folder or bucket if missing; raise if the backend is unreachable."""

    def put(self, key: str, data: bytes, content_type: str) -> None: ...

    def get(self, key: str) -> bytes: ...

    def delete_objects(self, keys: list[str]) -> None:
        """Delete these exact keys; missing keys are not an error."""

    def delete_prefix(self, prefix: str) -> None:
        """Delete every object whose key starts with ``prefix`` (a folder, ending in ``/``)."""
