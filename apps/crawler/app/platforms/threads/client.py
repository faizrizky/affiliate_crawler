from __future__ import annotations

import queue
import threading
import time
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import quote_plus, urlparse

import httpx
from structlog import get_logger

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads import socks_relay
from app.platforms.threads.selectors import (
    AUTHENTICATED_MARKERS,
    CONTENT_MARKERS,
    UNAUTHENTICATED_MARKERS,
)

log = get_logger()

SEARCH_URL = "https://www.threads.com/search?q={keyword}"
HOME_URL = "https://www.threads.com/"
LOGIN_URL = "https://www.threads.com/login"

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


SESSION_STATE_JS = """
(markers) => {
  const present = (list) => list.filter((sel) => {
    try { return document.querySelector(sel) !== null; } catch { return false; }
  });
  return {
    authenticated: present(markers.authenticated),
    unauthenticated: present(markers.unauthenticated),
  };
}
"""


def session_trust(page: Any) -> tuple[bool | None, list[str]]:
    """Return (trusted, markers_seen).

    trusted is True/False when the DOM answers it, None when neither list can
    decide (no positive marker configured and no login affordance on screen).
    """
    try:
        found = page.evaluate(
            SESSION_STATE_JS,
            {
                "authenticated": list(AUTHENTICATED_MARKERS),
                "unauthenticated": list(UNAUTHENTICATED_MARKERS),
            },
        ) or {}
    except Exception:
        return None, []
    authenticated = list(found.get("authenticated") or [])
    unauthenticated = list(found.get("unauthenticated") or [])
    if unauthenticated:
        return False, unauthenticated
    if authenticated:
        return True, authenticated
    # Tidak ada penanda login DAN daftar penanda positif terisi -> sesi tidak
    # dipercaya. Kalau daftar positif masih kosong, biarkan undecided daripada
    # menuduh sesi rusak tanpa bukti.
    if AUTHENTICATED_MARKERS:
        return False, []
    return None, []


@dataclass
class FetchedPage:
    html: str
    final_url: str
    status_code: int
    rendered: bool
    page_state: str = "unknown"
    # None = tidak bisa disimpulkan dari DOM (lihat session_trust)
    session_trusted: bool | None = None
    session_markers: tuple[str, ...] = ()


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
    server = settings.threads_proxy_server
    username = settings.threads_proxy_username
    password = settings.threads_proxy_password
    # proxy socks5 tanpa auth: arahkan ke relay lokal agar DNS diresolve di
    # sisi kami (DNS proxy upstream tidak bisa diandalkan). Proxy ber-credential
    # tetap direct karena relay hanya berbicara metode no-auth.
    if (
        socks_relay.port is not None
        and urlparse(server).scheme in {"socks5", "socks5h"}
        and not username
        and not password
    ):
        server = f"socks5://127.0.0.1:{socks_relay.port}"
    proxy: dict[str, Any] = {"server": server}
    if username:
        proxy["username"] = username
    if password:
        proxy["password"] = password
    log.debug("threads_proxy_configured", proxy_server=server)
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
        self._logged_in = False

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
                # socks5 proxy tanpa UDP associate: matikan QUIC/H3 (ERR_CONNECTION_RESET)
                self.context = self.playwright.chromium.launch_persistent_context(
                    self.profile, headless=True, args=["--disable-quic"], **self.context_options()
                )
            else:
                self.browser = self.playwright.chromium.launch(headless=True, args=["--disable-quic"])
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

    def ensure_login(self) -> None:
        """Verifikasi sesi profil persisten — TIDAK PERNAH mengisi/submit form login.

        ponytail: auto-login (isi username+password lalu klik submit) dihapus
        2026-09-12. Submit otomatis yang berulang — tiap restart proses dan tiap
        crawl selama sesi belum valid, lewat proxy yang bisa berganti IP — adalah
        pemicu klasik checkpoint 2FA Instagram, dan mengulanginya justru membuat
        akun makin dicurigai. Login dilakukan MANUAL sekali lewat VNC ke profil
        persisten; kode di sini hanya memeriksa hasilnya lalu berhenti dengan
        LOGIN_REQUIRED bila sesi tidak valid.

        CRAWLER_THREADS_USERNAME sekarang berfungsi sebagai saklar pemeriksaan
        ini (bukan kredensial yang dipakai login); CRAWLER_THREADS_PASSWORD tidak
        lagi dibaca oleh alur login mana pun.
        """
        if self._logged_in or not settings.threads_username:
            return
        if self.playwright is None:
            self.start()
        context, owned = self.acquire()
        page = context.new_page()
        try:
            page.goto(
                HOME_URL,
                wait_until="domcontentloaded",
                timeout=settings.threads_browser_timeout * 1000,
            )
            trusted, markers = self._probe_session(page)
            final_url = page.url or HOME_URL
            hard_wall = "/login" in urlparse(final_url).path or bool(
                page.query_selector('input[type="password"]')
            )
            if hard_wall:
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Profil browser belum login (Threads menampilkan login wall). "
                    "Login manual sekali ke profil persisten "
                    f"({settings.threads_browser_profile}) lalu jalankan "
                    "scripts/check_session.py untuk memastikan. "
                    "Crawler tidak akan mencoba login sendiri.",
                    status_code=403,
                )
            if trusted is False:
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Profil browser tidak dalam keadaan login "
                    f"(markers={list(markers) or 'tombol login terdeteksi'}). "
                    "Login manual sekali ke profil persisten "
                    f"({settings.threads_browser_profile}); "
                    "crawler tidak akan mencoba login sendiri.",
                    status_code=403,
                )
            # trusted True, atau None (belum bisa disimpulkan karena
            # AUTHENTICATED_MARKERS masih kosong) — jangan blokir crawl hanya
            # karena penanda positif belum terpasang.
            self._logged_in = True
            log.info(
                "threads_session_verified",
                final_url=final_url,
                session_trusted=trusted,
                markers=list(markers),
            )
        finally:
            page.close()
            if owned:
                context.close()

    @staticmethod
    def _probe_session(page: Any) -> tuple[bool | None, tuple[str, ...]]:
        """Tunggu nav selesai render lalu baca penanda sesi (read-only).

        ponytail: kesimpulan NEGATIF hanya boleh diambil setelah deadline habis.
        Threads sempat merender shell logged-out (tombol Login) sebelum hydration
        menukarnya dengan nav akun; menyimpulkan dari sinyal pertama membuat sesi
        yang sehat divonis LOGIN_REQUIRED (kejadian 2026-09-12).
        """
        deadline = time.monotonic() + min(20.0, settings.threads_content_wait)
        trusted: bool | None = None
        markers: tuple[str, ...] = ()
        while time.monotonic() < deadline:
            current, seen = session_trust(page)
            if current is True:
                return True, tuple(seen)
            if page.query_selector('input[type="password"]'):
                return False, tuple(seen)
            trusted, markers = current, tuple(seen)
            time.sleep(0.5)
        return trusted, markers

    def fetch(self, url: str) -> FetchedPage:
        if self.playwright is None:
            self.start()
        self.ensure_login()
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

                def _on_finished(request: Any) -> None:
                    # Event requestfinished membawa objek Request (bukan Response).
                    if _matches(request.url):
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
            trusted, markers = session_trust(page)
            log.info(
                "threads_session_trust",
                page_state=state,
                session_trusted=trusted,
                markers=markers,
                positive_markers_configured=len(AUTHENTICATED_MARKERS),
            )
            if state == "empty" and trusted is False:
                # Halaman search normal (bukan redirect /login, bukan form
                # password) tapi kosong DAN sesi tidak dipercaya: ini bukan
                # "keyword tanpa hasil".
                raise ThreadsError(
                    ThreadsErrorCode.SESSION_DEGRADED,
                    "Threads returned an empty search page with no trusted session "
                    f"(markers={markers or 'none'}). Log the browser profile in again; "
                    "retrying will not help.",
                    retryable=True,
                    status_code=403,
                )
            return FetchedPage(
                html=page.content(),
                final_url=final_url,
                status_code=200,
                rendered=True,
                page_state=state,
                session_trusted=trusted,
                session_markers=tuple(markers),
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

    def fetch_profile_posts(self, username: str, limit: int) -> list[dict[str, Any]]:
        """Buka profil sendiri lalu baca post yang tampil. Tidak menulis apa pun."""
        if self.playwright is None:
            self.start()
        self.ensure_login()
        context, owned = self.acquire()
        page = context.new_page()
        try:
            url = PROFILE_URL.format(username=username)
            try:
                page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=settings.threads_browser_timeout * 1000,
                )
            except Exception as exc:
                raise ThreadsError(
                    ThreadsErrorCode.REQUEST_FAILED,
                    f"profile load failed: {exc}",
                    retryable=True,
                ) from exc

            if "/login" in urlparse(page.url or url).path:
                raise ThreadsError(
                    ThreadsErrorCode.LOGIN_REQUIRED,
                    "Profil mengarahkan ke login; login manual ulang diperlukan.",
                    status_code=403,
                )

            deadline = time.monotonic() + min(20.0, settings.threads_content_wait)
            posts: list[dict[str, Any]] = []
            while time.monotonic() < deadline:
                try:
                    posts = list(page.evaluate(PROFILE_POSTS_JS, username) or [])
                except Exception:
                    posts = []
                if posts:
                    break
                time.sleep(0.5)

            trusted, markers = session_trust(page)
            if not posts and trusted is False:
                raise ThreadsError(
                    ThreadsErrorCode.SESSION_DEGRADED,
                    f"Profil tidak menampilkan post dan sesi tidak dipercaya (markers={markers or 'none'}).",
                    retryable=True,
                    status_code=403,
                )
            log.info(
                "threads_own_posts_fetched",
                username=username,
                count=len(posts),
                session_trusted=trusted,
            )
            return posts[:limit]
        finally:
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
        self._logged_in = False


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


PROFILE_URL = "https://www.threads.com/@{username}"

# Ekstraksi post milik sendiri dari halaman profil. Sengaja DOM-based (bukan
# relay JSON) karena yang dibutuhkan cuma teks + permalink + waktu, dan struktur
# DOM profil jauh lebih stabil daripada nama field relay yang berubah per rilis.
PROFILE_POSTS_JS = """
(username) => {
  const handle = '/@' + username.toLowerCase();
  const seen = new Map();
  for (const article of document.querySelectorAll('article')) {
    const link = Array.from(article.querySelectorAll('a[href*="/post/"]'))
      .map((a) => a.getAttribute('href'))
      .find((href) => href && href.toLowerCase().startsWith(handle));
    if (!link) continue;
    const time = article.querySelector('time[datetime]');
    const text = (article.innerText || '').trim();
    if (!text) continue;
    const url = link.startsWith('http') ? link : 'https://www.threads.com' + link;
    if (!seen.has(url)) {
      seen.set(url, {
        postUrl: url,
        text,
        createdAt: time ? time.getAttribute('datetime') : null,
      });
    }
  }
  return Array.from(seen.values());
}
"""


def fetch_own_posts(
    username: str, limit: int = 30, last_hours: int = 24
) -> list[dict[str, Any]]:
    """Ambil post terbaru dari sebuah profil (read-only, tanpa aksi apa pun).

    Hasil: [{"text", "postUrl", "createdAt"}], sudah disaring ke rentang
    last_hours. Post tanpa atribut waktu tetap disertakan — lebih baik
    dicocokkan lalu ditolak fuzzy-match daripada hilang diam-diam.
    """
    worker = _get_worker()
    posts = worker.call(worker.session.fetch_profile_posts, username, limit)
    if last_hours <= 0:
        return posts
    cutoff = datetime.now(timezone.utc) - timedelta(hours=last_hours)
    recent: list[dict[str, Any]] = []
    for post in posts:
        raw = post.get("createdAt")
        if not raw:
            recent.append(post)
            continue
        try:
            published = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            recent.append(post)
            continue
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        if published >= cutoff:
            recent.append(post)
    return recent
