"""The `screen.score` message: what the student's browser concluded about its own screen."""

from pydantic import BaseModel, Field


class ScreenScoreIn(BaseModel):
    """Only numbers. The frame and the OCR text never leave the device."""

    slide_index: int = Field(ge=0)
    similarity: float = Field(ge=0, le=1, allow_inf_nan=False)
    changed: bool = False
    ocr_chars: int = Field(default=0, ge=0)
