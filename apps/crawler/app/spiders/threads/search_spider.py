from __future__ import annotations

from urllib.parse import quote_plus

import httpx

from app.config.settings import settings
from app.exceptions import CrawlerError
from app.platforms.threads.parser import parse_threads_html

SEARCH_URL = "https://www.threads.net/search?q={keyword}"


def threads_search(keyword: str, limit: int) -> list[dict]:
    url = SEARCH_URL.format(keyword=quote_plus(keyword))
    try:
        response = httpx.get(
            url,
            headers={"User-Agent": settings.user_agent},
            timeout=settings.request_timeout,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        raise CrawlerError(f"fetch failed: {exc}") from exc
    if response.status_code != 200:
        raise CrawlerError(f"Threads responded {response.status_code}")
    posts = parse_threads_html(response.text)
    if not posts:
        raise CrawlerError("no threads found (possible login wall)")
    return posts[:limit]
