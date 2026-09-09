from __future__ import annotations

import time

from structlog import get_logger

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads.client import fetch_search_page
from app.platforms.threads.parser import parse_threads_html

log = get_logger()


def _backoff_delay(attempt: int) -> float:
    return settings.threads_retry_backoff_seconds * (2 ** (attempt - 1))


def threads_search(keyword: str, limit: int = 20) -> list[dict]:
    attempts = max(1, settings.threads_search_attempts)
    ambiguous: ThreadsError | None = None
    for attempt in range(1, attempts + 1):
        try:
            page = fetch_search_page(keyword)
        except ThreadsError as exc:
            if exc.retryable and attempt < attempts:
                delay = _backoff_delay(attempt)
                log.warning(
                    "threads_search_fetch_retry",
                    keyword=keyword,
                    attempt=attempt,
                    code=exc.code,
                    delay=delay,
                )
                time.sleep(delay)
                continue
            raise
        result = parse_threads_html(page.html)
        log.info(
            "threads_search_attempt",
            keyword=keyword,
            attempt=attempt,
            status_code=page.status_code,
            final_url=page.final_url,
            page_state=page.page_state,
            layer=result.layer,
            login_wall=result.login_wall,
            empty_results=result.empty_results,
            candidate_count=result.candidate_count,
            parsed=len(result.posts),
            locale=settings.threads_browser_locale,
            timezone=settings.threads_browser_timezone,
            persistent_profile=settings.threads_browser_profile is not None,
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
        ambiguous = ThreadsError(
            ThreadsErrorCode.UNSUPPORTED_STRUCTURE,
            "Could not confirm search result "
            f"(page_state={page.page_state}, layer={result.layer}, "
            f"candidates={result.candidate_count}).",
            retryable=True,
        )
        if attempt < attempts:
            delay = _backoff_delay(attempt)
            log.warning(
                "threads_search_ambiguous_retry",
                keyword=keyword,
                attempt=attempt,
                page_state=page.page_state,
                delay=delay,
            )
            time.sleep(delay)
    if ambiguous is not None:
        raise ambiguous
    return []
