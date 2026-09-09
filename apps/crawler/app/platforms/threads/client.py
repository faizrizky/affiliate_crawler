from __future__ import annotations

import time
from dataclasses import dataclass
from urllib.parse import quote_plus, urlparse

import httpx

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode

SEARCH_URL = "https://www.threads.com/search?q={keyword}"

CONTENT_MARKERS = ('"searchResults"', "__NEXT_DATA__", "<article", "data-testid")

PAGE_STATE_JS = """
() => {
  const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
  if (scripts.some((s) => s.textContent.includes('"searchResults"'))) return 'relay';
  if (document.querySelector('article')) return 'articles';
  if (window.location.pathname.includes('/login') || document.querySelector('input[type="password"]')) return 'login';
  const text = ((document.body && document.body.innerText) || '').toLowerCase();
  if (text.includes('no results') || text.includes('tidak ada hasil')) return 'empty';
  return 'loading';
}
"""


@dataclass
class FetchedPage:
    html: str
    final_url: str
    status_code: int
    rendered: bool
    page_state: str = "unknown"


def fetch_search_page(keyword: str) -> FetchedPage:
    url = SEARCH_URL.format(keyword=quote_plus(keyword))
    if settings.threads_use_browser:
        return _fetch_with_browser(url)
    return _fetch_with_httpx(url)


def _fetch_with_httpx(url: str) -> FetchedPage:
    try:
        response = httpx.get(
            url,
            headers={
                "User-Agent": settings.user_agent,
                "Accept-Language": settings.threads_accept_language,
            },
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
    return FetchedPage(
        html=html,
        final_url=str(response.url),
        status_code=200,
        rendered=False,
        page_state="static",
    )


def _wait_for_page_state(page: object) -> str:
    deadline = time.monotonic() + settings.threads_content_wait
    state = "loading"
    while True:
        try:
            state = str(page.evaluate(PAGE_STATE_JS) or "loading")
        except Exception:
            state = "loading"
        if state != "loading" or time.monotonic() >= deadline:
            return state
        time.sleep(0.5)


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
    context_options = dict(
        user_agent=settings.user_agent,
        locale=settings.threads_browser_locale,
        timezone_id=settings.threads_browser_timezone,
        extra_http_headers={"Accept-Language": settings.threads_accept_language},
    )
    browser = None
    with sync_playwright() as p:
        try:
            if profile:
                context = p.chromium.launch_persistent_context(profile, headless=True, **context_options)
            else:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(**context_options)
        except Exception as exc:
            raise ThreadsError(
                ThreadsErrorCode.RENDER_FAILED,
                f"browser launch failed: {exc}",
                status_code=503,
            ) from exc
        try:
            page = context.new_page()
            try:
                page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=settings.threads_browser_timeout * 1000,
                )
            except Exception as exc:
                raise ThreadsError(
                    ThreadsErrorCode.REQUEST_FAILED,
                    f"page load failed: {exc}",
                    retryable=True,
                ) from exc
            final_url = page.url or url
            if "/login" in urlparse(final_url).path:
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Redirected to Threads login page.",
                    status_code=403,
                )
            state = _wait_for_page_state(page)
            if state == "login":
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Threads login wall detected.",
                    status_code=403,
                )
            time.sleep(0.5)
            return FetchedPage(
                html=page.content(),
                final_url=final_url,
                status_code=200,
                rendered=True,
                page_state=state,
            )
        finally:
            context.close()
            if browser is not None:
                browser.close()
