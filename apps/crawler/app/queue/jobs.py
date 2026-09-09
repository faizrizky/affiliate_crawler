from __future__ import annotations

from pydantic import BaseModel, Field


class CrawlJobRequest(BaseModel):
    keyword: str = Field(min_length=3, max_length=120)
    limit: int = Field(default=20, ge=1, le=100)
