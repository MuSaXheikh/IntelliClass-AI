"""Slide-image stores: local disk and the Supabase Storage REST backend (mocked transport)."""

from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import ApiError
from app.services.storage import LocalStorage, SupabaseStorage, get_storage


def test_local_roundtrip_and_delete(tmp_path: Path) -> None:
    store = LocalStorage(str(tmp_path))
    store.ensure_ready()
    store.put("slides/c1/0.png", b"png0", "image/png")
    store.put("slides/c1/1.png", b"png1", "image/png")
    assert store.get("slides/c1/1.png") == b"png1"
    store.delete_prefix("slides/c1/")
    with pytest.raises(ApiError) as exc:
        store.get("slides/c1/0.png")
    assert exc.value.status_code == 404
    with pytest.raises(ValueError):
        store.get("../outside.png")


def _supabase(handler: object) -> SupabaseStorage:
    client = httpx.Client(
        base_url="http://supabase.test/storage/v1",
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        headers={"Authorization": "Bearer service-key", "apikey": "service-key"},
    )
    return SupabaseStorage("http://supabase.test", "service-key", "slides", client=client)


def test_supabase_backend_uses_storage_api() -> None:
    calls: list[tuple[str, str]] = []
    objects: dict[str, bytes] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append((req.method, req.url.path))
        assert req.headers["authorization"] == "Bearer service-key"
        path = req.url.path
        if path == "/storage/v1/bucket/slides":
            return httpx.Response(404)
        if path == "/storage/v1/bucket":
            return httpx.Response(200, json={"name": "slides"})
        if path.startswith("/storage/v1/object/list/slides"):
            prefix = req.read().decode()
            names = [k.rsplit("/", 1)[1] for k in objects if f'"{k.rsplit("/", 1)[0]}"' in prefix]
            return httpx.Response(200, json=[{"name": n} for n in names])
        if path.startswith("/storage/v1/object/authenticated/slides/"):
            key = path.split("/authenticated/slides/", 1)[1]
            return (
                httpx.Response(200, content=objects[key]) if key in objects else httpx.Response(404)
            )
        if path == "/storage/v1/object/slides" and req.method == "DELETE":
            for k in list(objects):
                if k.encode() in req.read():
                    del objects[k]
            return httpx.Response(200, json=[])
        if path.startswith("/storage/v1/object/slides/") and req.method == "POST":
            assert req.headers["x-upsert"] == "true" and req.headers["content-type"] == "image/png"
            objects[path.split("/object/slides/", 1)[1]] = req.read()
            return httpx.Response(200, json={"Key": path})
        return httpx.Response(500)

    store = _supabase(handler)
    store.ensure_ready()
    assert ("POST", "/storage/v1/bucket") in calls
    store.put("slides/c1/0.png", b"png0", "image/png")
    assert store.get("slides/c1/0.png") == b"png0"
    store.delete_prefix("slides/c1/")
    assert objects == {}
    with pytest.raises(ApiError) as exc:
        store.get("slides/c1/0.png")
    assert exc.value.status_code == 404


def test_supabase_unreachable_becomes_503() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=req)

    with pytest.raises(ApiError) as exc:
        _supabase(handler).put("slides/c1/0.png", b"x", "image/png")
    assert exc.value.status_code == 503


def test_get_storage_picks_backend(tmp_path: Path) -> None:
    local = Settings.model_construct(storage_backend="local", storage_dir=str(tmp_path))
    assert isinstance(get_storage(local), LocalStorage)
    cloud = Settings.model_construct(
        storage_backend="supabase",
        supabase_url="http://supabase.test",
        supabase_service_key="k",
        supabase_bucket="slides",
    )
    assert isinstance(get_storage(cloud), SupabaseStorage)
    missing = Settings.model_construct(storage_backend="supabase", supabase_url=None)
    with pytest.raises(RuntimeError):
        get_storage(missing)
