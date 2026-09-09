from __future__ import annotations

from structlog import get_logger

from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads.client import fetch_search_page
from app.platforms.threads.parser import parse_threads_html

log = get_logger()


def threads_search(keyword: str, limit: int = 20) -> list[dict]:
    page = fetch_search_page(keyword)
    result = parse_threads_html(page.html)
    log.info(
        "threads_search_parsed",
        keyword=keyword,
        status_code=page.status_code,
        final_url=page.final_url,
        content_length=len(page.html),
        rendered=page.rendered,
        layer=result.layer,
        login_wall=result.login_wall,
        empty_results=result.empty_results,
        candidate_count=result.candidate_count,
        parsed=len(result.posts),
    )
    if result.posts:
        return result.posts[:limit]
    if result.login_wall:
        raise ThreadsError(
            ThreadsErrorCode.LOGIN_REQUIRED,
            "Threads login wall detected. "
            "Set CRAWLER_THREADS_BROWSER_PROFILE to a logged-in browser profile.",
            status_code=403,
        )
    if result.empty_results:
        return []
    raise ThreadsError(
        ThreadsErrorCode.UNSUPPORTED_STRUCTURE,
        "Could not extract threads from page "
        f"(layer={result.layer}, candidates={result.candidate_count}).",
    )
