from __future__ import annotations

import time

from structlog import get_logger

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads.client import fetch_search_page
from app.platforms.threads.parser import parse_threads_html

log = get_logger()


# Sesi yang benar-benar degraded tidak sembuh dengan diulang; satu retry cukup
# untuk menyingkirkan kebetulan (render belum selesai), setelah itu naikkan.
SESSION_DEGRADED_ATTEMPTS = 2


def _backoff_delay(attempt: int) -> float:
    return settings.threads_retry_backoff_seconds * (2 ** (attempt - 1))


def threads_search(keyword: str, limit: int = 20) -> list[dict]:
    posts = _search_once(keyword, limit)
    if not posts and " " in keyword:
        # ponytail: SSR /search?q= match frasa persis (multi-kata sering
        # kosong), UI Threads match per-kata/semantik. Fallback ke kata
        # terdepan; pipeline relevansi tetap ranking terhadap keyword penuh.
        fallback = keyword.split()[0]
        log.info("threads_search_phrase_fallback", keyword=keyword, fallback=fallback)
        posts = _search_once(fallback, limit)
    return posts


def _search_once(keyword: str, limit: int) -> list[dict]:
    attempts = max(1, settings.threads_search_attempts)
    ambiguous: ThreadsError | None = None
    degraded_attempts = 0
    for attempt in range(1, attempts + 1):
        try:
            page = fetch_search_page(keyword)
        except ThreadsError as exc:
            if exc.code == ThreadsErrorCode.SESSION_DEGRADED:
                degraded_attempts += 1
                if degraded_attempts >= SESSION_DEGRADED_ATTEMPTS:
                    log.warning(
                        "threads_search_session_degraded",
                        keyword=keyword,
                        attempt=attempt,
                        attempts_used=degraded_attempts,
                    )
                    raise
                delay = _backoff_delay(attempt)
                log.warning(
                    "threads_search_session_degraded_retry",
                    keyword=keyword,
                    attempt=attempt,
                    delay=delay,
                )
                time.sleep(delay)
                continue
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
            proxy_server=settings.threads_proxy_server,
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
        if page.session_trusted is False:
            # Struktur halaman normal tapi sesi tidak dipercaya dan tidak ada
            # satu pun post yang terparse: jangan pura-pura "tidak ada hasil".
            degraded_attempts += 1
            degraded = ThreadsError(
                ThreadsErrorCode.SESSION_DEGRADED,
                "Threads served a normal search page without a trusted session "
                f"and no results (markers={list(page.session_markers) or 'none'}). "
                "Log the browser profile in again; retrying will not help.",
                retryable=True,
                status_code=403,
            )
            if degraded_attempts >= SESSION_DEGRADED_ATTEMPTS:
                log.warning(
                    "threads_search_session_degraded",
                    keyword=keyword,
                    attempt=attempt,
                    empty_results=result.empty_results,
                    markers=list(page.session_markers),
                )
                raise degraded
            delay = _backoff_delay(attempt)
            log.warning(
                "threads_search_session_degraded_retry",
                keyword=keyword,
                attempt=attempt,
                delay=delay,
            )
            time.sleep(delay)
            continue
        if result.empty_results:
            # 'empty' sudah dikonfirmasi network-idle upstream (client menunggu
            # request data search selesai sebelum final), jadi [] adalah final.
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
                rendered=page.rendered,
                final_url=page.final_url,
                delay=delay,
            )
            time.sleep(delay)
    if ambiguous is not None:
        raise ambiguous
    return []
