"""Local-disk backend: keys map to files under STORAGE_DIR."""

import shutil
from pathlib import Path

from app.core.errors import ApiError


class LocalStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root)

    def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        root = self.root.resolve()
        path = (root / key).resolve()
        if root not in path.parents:
            raise ValueError(f"storage key escapes the storage root: {key!r}")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:  # noqa: ARG002
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError as exc:
            raise ApiError(404, "IMAGE_NOT_FOUND", "Slide image is missing") from exc

    def delete_prefix(self, prefix: str) -> None:
        shutil.rmtree(self._path(prefix), ignore_errors=True)
