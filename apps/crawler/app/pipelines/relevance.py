from __future__ import annotations

import re

from app.models.normalized_post import NormalizedPost

AFFILIATE_LINK_RE = re.compile(
    r"(ref=|aff=|via=|utm_source=|amzn\.to|amazon\.to|/p/|track\.|click\.|offer=)",
    re.I,
)
REVIEW_WORDS = (
    "review",
    "versus",
    "vs.",
    "alternative",
    "best",
    "worth",
    "recommend",
    "unboxing",
    "comparison",
)


def relevance_score(keyword: str, post: NormalizedPost) -> int:
    # Relevance = keyword match only. Engagement (likes/replies) is
    # deliberately excluded: a viral unrelated post must not outrank a
    # relevant one. 60 for the exact phrase, +15 per keyword word present.
    text = (post.content or "").lower()
    kw = keyword.strip().lower()
    if not kw or not text:
        return 0
    words = [w for w in kw.split() if len(w) > 2]
    if not words and kw not in text:
        return 0
    score = 60 if kw in text else 0
    score += sum(1 for w in words if w in text) * 15
    return min(score, 100)


def affiliate_score(post: NormalizedPost) -> int:
    text = (post.content or "").lower()
    score = 0
    if AFFILIATE_LINK_RE.search(text):
        score += 30
    if any(word in text for word in REVIEW_WORDS):
        score += 30
    if post.like_count >= 1000:
        score += 20
    if post.reply_count >= 100:
        score += 20
    return min(score, 100)
