"""Shared schema base."""

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    """Pydantic model that can be built from ORM rows."""

    model_config = ConfigDict(from_attributes=True)
