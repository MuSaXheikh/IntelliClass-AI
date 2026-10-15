"""Settings page schemas: alert preferences, profile and password changes."""

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import OrmModel


class AlertPreferences(OrmModel):
    """Effective values (saved overrides or the global defaults)."""

    drowsy_min_seconds: float
    lookaway_min_seconds: float
    noface_min_seconds: float
    camera_off_min_seconds: float
    screen_grace_seconds: float
    alert_cooldown_seconds: float
    alert_confidence_threshold: float
    nudge_rate_limit: int


class AlertPreferencesIn(BaseModel):
    """What an instructor may save; bounds keep the engine sane and the UI mirrors them."""

    drowsy_min_seconds: float = Field(ge=2, le=120)
    lookaway_min_seconds: float = Field(ge=2, le=120)
    noface_min_seconds: float = Field(ge=2, le=120)
    camera_off_min_seconds: float = Field(ge=2, le=120)
    screen_grace_seconds: float = Field(ge=2, le=120)
    alert_cooldown_seconds: float = Field(ge=10, le=900)
    alert_confidence_threshold: float = Field(ge=0.3, le=0.95)
    nudge_rate_limit: int = Field(ge=1, le=10)


class AlertPreferencesOut(BaseModel):
    values: AlertPreferences
    defaults: AlertPreferences
    customised: bool


class ProfileUpdateIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("full_name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("name is too short")
        return value


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
