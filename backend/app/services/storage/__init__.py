"""Pick the slide-image store from settings (STORAGE_BACKEND=local|supabase)."""

from app.core.config import Settings
from app.services.storage.base import ObjectStorage
from app.services.storage.local import LocalStorage
from app.services.storage.supabase import SupabaseStorage

__all__ = ["LocalStorage", "ObjectStorage", "SupabaseStorage", "get_storage"]


def get_storage(settings: Settings) -> ObjectStorage:
    if settings.storage_backend == "supabase":
        if not (settings.supabase_url and settings.supabase_service_key):
            raise RuntimeError(
                "STORAGE_BACKEND=supabase needs SUPABASE_URL and SUPABASE_SERVICE_KEY"
            )
        return SupabaseStorage(
            settings.supabase_url, settings.supabase_service_key, settings.supabase_bucket
        )
    return LocalStorage(settings.storage_dir)
