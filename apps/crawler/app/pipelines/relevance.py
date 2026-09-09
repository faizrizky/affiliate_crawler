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


INDONESIA_MARKERS = frozenset(
    {
        "yang", "dan", "untuk", "dengan", "adalah", "bisa", "pakai", "pake",
        "harga", "beli", "gratis", "murah", "bagus", "cara", "ini", "itu",
        "juga", "karena", "tapi", "atau", "saya", "kita", "kalau", "sama",
        "dari", "ke", "pada", "di", "kualitas", "rekomendasi",
    }
)


def _indonesia_bonus(text: str) -> int:
    # ponytail: function-word heuristic, not real language detection;
    # upgrade to langdetect if ranking precision matters.
    hits = len(set(text.split()) & INDONESIA_MARKERS)
    return min(hits * 5, 20)


def relevance_score(keyword: str, post: NormalizedPost) -> int:
    text = (post.content or "").lower()
    score = 0
    if keyword.strip().lower() in text:
        score += 50
    for word in keyword.lower().split():
        if len(word) > 2 and word in text:
            score += 10
    score += min(post.like_count, 1000) // 10
    score += _indonesia_bonus(text)
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
