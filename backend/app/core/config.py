"""Application settings. Every tunable threshold lives here, never hard-coded."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration (see backend/.env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "IntelliClass AI API"
    environment: str = "local"
    database_url: str = "sqlite:///./intelliclass.db"
    auto_create_tables: bool = False  # schema comes from Alembic; tests set this to true
    redis_url: str | None = None
    jwt_secret: str  # required: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120
    allowed_origins: str = "http://localhost:3000"
    # Slide images: local files under storage_dir, or a private Supabase Storage bucket
    storage_backend: Literal["local", "supabase"] = "local"
    storage_dir: str = "./storage"
    supabase_url: str | None = None  # API URL (http://127.0.0.1:54321 locally)
    supabase_service_key: str | None = None  # service-role key, server-side only
    supabase_bucket: str = "slides"

    livekit_url: str | None = None
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None

    # Vision thresholds (placeholders until tuned on the validation set, task AI-04)
    vision_fps: int = 8
    ear_closed_threshold: float = 0.20
    perclos_sleepy_threshold: float = 0.60
    landmark_conf_min: float = 0.50
    head_yaw_limit_deg: float = 30.0
    head_pitch_limit_deg: float = 25.0
    feature_smoothing_packets: int = (
        1  # the client already averages a full second of frames per packet
    )
    vision_debug_log: bool = False  # log smoothed features per packet (calibration sessions only)

    # Persistence before an alert may be raised (seconds)
    drowsy_min_seconds: float = 5.0
    lookaway_min_seconds: float = 12.0
    noface_min_seconds: float = 8.0
    camera_off_min_seconds: float = 8.0
    screen_grace_seconds: float = 12.0
    connection_timeout_seconds: float = 8.0
    status_hold_seconds: float = 1.0  # a condition must last this long before the badge changes

    # Alert engine
    alert_confidence_threshold: float = 0.60
    alert_cooldown_seconds: float = 60.0
    alert_group_window_seconds: float = 600.0

    # Private nudge
    nudge_rate_limit: int = 3
    nudge_rate_window_seconds: float = 600.0

    @field_validator("jwt_secret")
    @classmethod
    def _secret_is_strong(cls, value: str) -> str:
        if len(value) < 32 or "change_me" in value:
            raise ValueError("JWT_SECRET must be a random string of at least 32 characters")
        return value

    @property
    def origins(self) -> list[str]:
        """Allowed CORS origins as a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def livekit_configured(self) -> bool:
        """True when all three LiveKit settings are present."""
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
