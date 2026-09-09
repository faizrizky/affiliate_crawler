from __future__ import annotations

from app.models.normalized_post import NormalizedPost


def dedupe(posts: list[NormalizedPost]) -> list[NormalizedPost]:
    seen: set[str] = set()
    out: list[NormalizedPost] = []
    for post in posts:
        key = post.external_id or post.source_url
        if key in seen:
            continue
        seen.add(key)
        out.append(post)
    return out
