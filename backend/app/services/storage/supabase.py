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
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not read the slide image") from exc
        if res.status_code == 404:
            raise ApiError(404, "IMAGE_NOT_FOUND", "Slide image is missing")
        res.raise_for_status()
        return res.content

    def delete_prefix(self, prefix: str) -> None:
        folder = prefix.rstrip("/")
        try:
            res = self._client.post(
                f"/object/list/{self.bucket}", json={"prefix": folder, "limit": 1000, "offset": 0}
            )
            res.raise_for_status()
            names = [f"{folder}/{item['name']}" for item in res.json() if item.get("name")]
            if names:
                self._client.request(
                    "DELETE", f"/object/{self.bucket}", json={"prefixes": names}
                ).raise_for_status()
        except httpx.HTTPError as exc:
            raise ApiError(503, "STORAGE_UNAVAILABLE", "Could not delete old slides") from exc
