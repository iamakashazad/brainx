from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(String, nullable=False, default="PENDING")
    stage = Column(String, nullable=True)
    queue_position = Column(Integer, nullable=True)
    result_json = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
        nullable=False,
    )
    retry_count = Column(Integer, default=0)
    input_path = Column(String, nullable=True)
    input_type = Column(String, nullable=True)
