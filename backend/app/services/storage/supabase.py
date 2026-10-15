"""Supabase Storage backend: a private bucket accessed with the service-role key.

Uses the Storage REST API directly (no SDK): upload with upsert, authenticated download,
list + delete for a folder. The same code talks to a local ``supabase start`` stack and to a
cloud project; only SUPABASE_URL and the key change.
"""

import logging

import httpx

from app.core.errors import ApiError

logger = logging.getLogger(__name__)


class SupabaseStorage:
    def __init__(
        self, url: str, service_key: str, bucket: str, client: httpx.Client | None = None
    ) -> None:
        self.bucket = bucket
        self._client = client or httpx.Client(
            base_url=f"{url.rstrip('/')}/storage/v1",
            headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
            timeout=30.0,
        )

    def ensure_ready(self) -> None:
        if self._client.get(f"/bucket/{self.bucket}").status_code == 200:
            return
        res = self._client.post(
            "/bucket", json={"id": self.bucket, "name": self.bucket, "public": False}
        )
        if res.status_code not in (200, 201) and "exists" not in res.text:
            res.raise_for_status()
        logger.info("created private storage bucket %s", self.bucket)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        try:
            res = self._client.post(
                f"/object/{self.bucket}/{key}",
                content=data,
                headers={"Content-Type": content_type, "x-upsert": "true"},
            )
            res.raise_for_status()
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not store the slide image") from exc

    def get(self, key: str) -> bytes:
        try:
            res = self._client.get(f"/object/authenticated/{self.bucket}/{key}")
            if res.status_code == 404:
                raise ApiError(404, "IMAGE_NOT_FOUND", "Slide image is missing")
            res.raise_for_status()
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not read the slide image") from exc
        return res.content

    def delete_objects(self, keys: list[str]) -> None:
        try:
            for start in range(0, len(keys), 100):
                chunk = keys[start : start + 100]
                self._client.request(
                    "DELETE", f"/object/{self.bucket}", json={"prefixes": chunk}
                ).raise_for_status()
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not delete slide images") from exc

    def _list_keys(self, folder: str) -> list[str]:
        """Every object key under a folder; the Storage API lists one level at a time."""
        res = self._client.post(
            f"/object/list/{self.bucket}", json={"prefix": folder, "limit": 1000, "offset": 0}
        )
        res.raise_for_status()
        keys: list[str] = []
        for item in res.json():
            name = item.get("name")
            if not name:
                continue
            if item.get("id"):
                keys.append(f"{folder}/{name}")
            else:  # a sub-folder (no object id): recurse
                keys.extend(self._list_keys(f"{folder}/{name}"))
        return keys

    def delete_prefix(self, prefix: str) -> None:
        folder = prefix.rstrip("/")
        try:
            keys = self._list_keys(folder)
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not list slide images") from exc
        if keys:
            self.delete_objects(keys)
