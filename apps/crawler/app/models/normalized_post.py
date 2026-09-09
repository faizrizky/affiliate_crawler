from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class NormalizedPost(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    external_id: str
    author_username: str
    author_display_name: str | None = None
    author_avatar_url: str | None = None
    content: str
    media_urls: list[str] = []
    like_count: int = 0
    reply_count: int = 0
    repost_count: int = 0
    source_url: str
    published_at: str | None = None
    relevance_score: int | None = None
    affiliate_score: int | None = None
