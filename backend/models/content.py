from __future__ import annotations

import datetime as dt
import enum
import uuid

from sqlalchemy import Column, DateTime, Integer, JSON, String

from backend.models.job import Base


class ContentType(str, enum.Enum):
    UI_SCREENS = "ui_screens"
    STATIC = "static"
    TEXT = "text"


class Content(Base):
    __tablename__ = "contents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    content_type = Column(String, nullable=False)
    screen_count = Column(Integer, nullable=True)
    content_text = Column(String, nullable=True)
    meta_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
