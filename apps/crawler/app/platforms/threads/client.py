from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import quote_plus, urlparse

import httpx
from structlog import get_logger

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads.selectors import CONTENT_MARKERS

log = get_logger()

SEARCH_URL = "https://www.threads.com/search?q={keyword}"

PAGE_STATE_JS = """
() => {
  const isSettledRelay = (node) => {
    if (node === null || typeof node !== 'object') return false;
    if (Array.isArray(node)) {
      for (const item of node) if (isSettledRelay(item)) return true;
      return false;
    }
    const sr = node.searchResults;
    if (sr && typeof sr === 'object' && !Array.isArray(sr) && Array.isArray(sr.edges)) return true;
    for (const value of Object.values(node)) if (isSettledRelay(value)) return true;
    return false;
  };
  const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
  for (const s of scripts) {
    if (!s.textContent.includes('"searchResults"')) continue;
    let data;
    try { data = JSON.parse(s.textContent); } catch { continue; }
    if (isSettledRelay(data)) return 'relay';
  }
  if (document.querySelector('article')) return 'articles';
  if (window.location.pathname.includes('/login') || document.querySelector('input[type="password"]')) return 'login';
  const text = ((document.body && document.body.innerText) || '').toLowerCase();
  if (text.includes('verifying your browser') || text.includes('verifikasi')
      || text.includes('unusual activity') || text.includes('selesaikan')) return 'challenge';
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


# State yang terminal dan boleh langsung final tanpa konfirmasi network-idle:
# login/challenge (perlu raise) dan articles (sudah ada hasil). 'relay'/'empty'
# menunggu request data search selesai (lihat _wait_for_page_state).
_IMMEDIATE_FINAL = {"login", "challenge", "articles"}


def _log_settle(state: str, started: float, *, via_deadline: bool) -> None:
    log.info(
        "threads_page_state_settle",
        state=state,
        wait_seconds=round(time.monotonic() - started, 3),
        via_deadline=via_deadline,
    )


def _wait_for_page_state(page: Any, in_flight_count: Callable[[], int]) -> str:
    deadline = time.monotonic() + settings.threads_content_wait
    started = time.monotonic()
    state = "loading"
    last_logged: str | None = None
    while True:
        try:
            state = str(page.evaluate(PAGE_STATE_JS) or "loading")
        except Exception:
            state = "loading"
        if state != last_logged:
            log.debug("threads_page_state", state=state)
            last_logged = state
        if state in _IMMEDIATE_FINAL:
            _log_settle(state, started, via_deadline=False)
            return state
        # 'relay'/'empty' hanya final saat request data search sudah selesai,
        # supaya 'empty' tidak dipanen di tengah load (gagal intermittent).
        if state != "loading" and in_flight_count() == 0:
            _log_settle(state, started, via_deadline=False)
            return state
        if time.monotonic() >= deadline:
            _log_settle(state, started, via_deadline=True)
            return state
        time.sleep(0.5)


def _proxy_options() -> dict[str, Any] | None:
    if not settings.threads_proxy_server:
        return None
    proxy: dict[str, Any] = {"server": settings.threads_proxy_server}
    if settings.threads_proxy_username:
        proxy["username"] = settings.threads_proxy_username
    if settings.threads_proxy_password:
        proxy["password"] = settings.threads_proxy_password
    log.debug("threads_proxy_configured", proxy_server=settings.threads_proxy_server)
    return proxy


class BrowserSession:
    """Shared Playwright session for the worker thread.

    ponytail: one shared session (Playwright sync API is bound to the thread
    that started it); per-request isolation comes from a fresh page per fetch.
    """

    def __init__(self) -> None:
        self.playwright: Any = None
        self.browser: Any = None
        self.context: Any = None
        self.profile: str | None = None

    def context_options(self) -> dict[str, Any]:
        options = dict(
            user_agent=settings.user_agent,
            locale=settings.threads_browser_locale,
            timezone_id=settings.threads_browser_timezone,
            extra_http_headers={"Accept-Language": settings.threads_accept_language},
        )
        proxy = _proxy_options()
        if proxy is not None:
            options["proxy"] = proxy
        return options

    def start(self) -> None:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise ThreadsError(
                ThreadsErrorCode.RENDER_FAILED,
                "playwright not installed. Run: pip install playwright && playwright install chromium",
                status_code=503,
            ) from exc
        self.playwright = sync_playwright().start()
        try:
            if settings.threads_browser_profile:
                self.profile = settings.threads_browser_profile
                self.context = self.playwright.chromium.launch_persistent_context(
                    self.profile, headless=True, **self.context_options()
                )
            else:
                self.browser = self.playwright.chromium.launch(headless=True)
        except Exception as exc:
            self.close()
            raise ThreadsError(
                ThreadsErrorCode.RENDER_FAILED,
                f"browser launch failed: {exc}",
                retryable=True,
                status_code=503,
            ) from exc

    def acquire(self) -> tuple[Any, bool]:
        """Return (context, owned). Persistent context is reused, never owned."""
        if self.context is not None:
            return self.context, False
        return self.browser.new_context(**self.context_options()), True

    def fetch(self, url: str) -> FetchedPage:
        if self.playwright is None:
            self.start()
        context, owned = self.acquire()
        page = context.new_page()
        inflight = {"count": 0}
        pattern = settings.threads_search_request_pattern
        listeners: list[tuple[str, Callable[..., None]]] = []
        try:
            if pattern:
                def _matches(target: str) -> bool:
                    return pattern in target

                def _on_request(request: Any) -> None:
                    if _matches(request.url):
                        inflight["count"] += 1

                def _on_finished(response: Any) -> None:
                    if _matches(response.request.url):
                        inflight["count"] = max(0, inflight["count"] - 1)

                def _on_failed(request: Any) -> None:
                    if _matches(request.url):
                        inflight["count"] = max(0, inflight["count"] - 1)

                page.on("request", _on_request)
                page.on("requestfinished", _on_finished)
                page.on("requestfailed", _on_failed)
                listeners = [
                    ("request", _on_request),
                    ("requestfinished", _on_finished),
                    ("requestfailed", _on_failed),
                ]

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
            state = _wait_for_page_state(page, lambda: inflight["count"])
            if state == "login":
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Threads login wall detected.",
                    status_code=403,
                )
            if state == "challenge":
                raise ThreadsError(
                    ThreadsErrorCode.CHALLENGE,
                    "Threads challenge/verification page detected. "
                    "Provision a logged-in browser profile; retrying immediately will not help.",
                    status_code=503,
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
            for event, handler in listeners:
                try:
                    page.remove_listener(event, handler)
                except Exception:
                    pass
            page.close()
            if owned:
                context.close()

    def close(self) -> None:
        closers = []
        if self.context is not None:
            closers.append(self.context.close)
        if self.browser is not None:
            closers.append(self.browser.close)
        if self.playwright is not None:
            closers.append(self.playwright.stop)
        for closer in closers:
            try:
                closer()
            except Exception:
                pass
        self.context = None
        self.browser = None
        self.playwright = None
        self.profile = None


class BrowserWorker:
    """Runs every browser operation on one dedicated thread.

    ponytail: single global worker; Playwright sync API cannot be shared
    across threads. If concurrent crawl throughput matters, upgrade to async
    Playwright with a pool of workers.
    """

    def __init__(self) -> None:
        self.session = BrowserSession()
        self._tasks: queue.Queue[tuple[Callable, tuple, queue.Queue] | None] = queue.Queue()
        self._thread = threading.Thread(target=self._run, name="threads-browser", daemon=True)
        self._thread.start()

    def call(self, fn: Callable, *args: Any) -> Any:
        result: queue.Queue = queue.Queue(maxsize=1)
        self._tasks.put((fn, args, result))
        timeout = settings.threads_browser_timeout + settings.threads_content_wait + 30
        try:
            failed, value = result.get(timeout=timeout)
        except queue.Empty as exc:
            raise ThreadsError(
                ThreadsErrorCode.REQUEST_FAILED,
                "browser worker did not respond in time",
                retryable=True,
            ) from exc
        if failed:
            raise value
        return value

    def stop(self) -> None:
        self._tasks.put(None)
        self._thread.join(timeout=30)

    def _run(self) -> None:
        while True:
            item = self._tasks.get()
            if item is None:
                self.session.close()
                return
            fn, args, result = item
            try:
                value = fn(*args)
            except BaseException as exc:
                result.put((True, exc))
            else:
                result.put((False, value))


_worker: BrowserWorker | None = None
_worker_lock = threading.Lock()


def _get_worker() -> BrowserWorker:
    global _worker
    with _worker_lock:
        if _worker is None:
            _worker = BrowserWorker()
        return _worker


def shutdown_browser() -> None:
    """Stop the browser worker (called from the app lifespan on shutdown)."""
    global _worker
    with _worker_lock:
        worker, _worker = _worker, None
    if worker is not None:
        worker.stop()


def fetch_search_page(keyword: str) -> FetchedPage:
    url = SEARCH_URL.format(keyword=quote_plus(keyword))
    if settings.threads_use_browser:
        worker = _get_worker()
        return worker.call(worker.session.fetch, url)
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
