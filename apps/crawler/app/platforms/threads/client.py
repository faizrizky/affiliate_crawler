from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote_plus

import httpx

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode

SEARCH_URL = "https://www.threads.com/search?q={keyword}"

CONTENT_MARKERS = ('"searchResults"', "__NEXT_DATA__", "<article", "data-testid")
CONTENT_WAIT_JS = """
() => {
  const html = document.body ? document.body.innerHTML : '';
  return html.includes('"searchResults"')
    || html.includes('__NEXT_DATA__')
    || html.includes('<article');
}
"""


@dataclass
class FetchedPage:
    html: str
    final_url: str
    status_code: int
    rendered: bool


def fetch_search_page(keyword: str) -> FetchedPage:
    url = SEARCH_URL.format(keyword=quote_plus(keyword))
    if settings.threads_use_browser:
        return _fetch_with_browser(url)
    return _fetch_with_httpx(url)


def _fetch_with_httpx(url: str) -> FetchedPage:
    try:
        response = httpx.get(
            url,
            headers={"User-Agent": settings.user_agent},
            timeout=settings.request_timeout,
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        raise ThreadsError(
            ThreadsErrorCode.REQUEST_FAILED,
            f"fetch failed: {exc}",
            retryable=True,
        ) from exc
    if response.status_code != 200:
        raise ThreadsError(
            ThreadsErrorCode.REQUEST_FAILED,
            f"Threads responded {response.status_code}",
            retryable=True,
        )
    html = response.text
    if not any(marker in html for marker in CONTENT_MARKERS):
        raise ThreadsError(
            ThreadsErrorCode.RENDER_FAILED,
            "JavaScript challenge page. Enable browser rendering (CRAWLER_THREADS_USE_BROWSER=true).",
        )
    return FetchedPage(html=html, final_url=str(response.url), status_code=200, rendered=False)


def _fetch_with_browser(url: str) -> FetchedPage:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise ThreadsError(
            ThreadsErrorCode.RENDER_FAILED,
            "playwright not installed. Run: pip install playwright && playwright install chromium",
            status_code=503,
        ) from exc

    profile = settings.threads_browser_profile
    browser = None
    with sync_playwright() as p:
        try:
            if profile:
                context = p.chromium.launch_persistent_context(
                    profile,
                    headless=True,
                    user_agent=settings.user_agent,
                )
            else:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent=settings.user_agent)
        except Exception as exc:
            raise ThreadsError(
                ThreadsErrorCode.RENDER_FAILED,
                f"browser launch failed: {exc}",
                status_code=503,
            ) from exc
        try:
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=settings.threads_browser_timeout * 1000)
            except Exception as exc:
                raise ThreadsError(
                    ThreadsErrorCode.REQUEST_FAILED,
                    f"page load failed: {exc}",
                    retryable=True,
                ) from exc
            try:
                page.wait_for_function(CONTENT_WAIT_JS, timeout=settings.threads_content_wait * 1000)
            except Exception:
                pass
            return FetchedPage(
                html=page.content(),
                final_url=page.url,
                status_code=200,
                rendered=True,
            )
        finally:
            context.close()
            if browser is not None:
                browser.close()
