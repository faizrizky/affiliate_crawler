from __future__ import annotations

from app.models.normalized_post import NormalizedPost


def normalize(raw: dict) -> NormalizedPost:
    return NormalizedPost.model_validate(raw)
