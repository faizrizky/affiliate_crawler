import sys
import time
import types

import pytest

from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads import client as client_module
from app.platforms.threads.client import BrowserSession, BrowserWorker, FetchedPage

URL = "https://www.threads.com/search?q=gatal"
RELAY_HTML = '<html><body><script type="application/json">{"searchResults":{"edges":[]}}</script></body></html>'


@pytest.fixture(autouse=True)
def _login_disabled_by_default(monkeypatch):
    # Unit test fetch() memakai fake page; login butuh browser sungguhan.
    monkeypatch.setattr(settings, "threads_username", None)


def relay_html() -> str:
    return RELAY_HTML


class FakePage:
    def __init__(self, context):
        self.context = context
        self.url = "https://www.threads.com/search?q=gatal"
        self.closed = False

    def goto(self, url, wait_until=None, timeout=None):
        self.context.events.append(("goto", url, wait_until, timeout))
        if self.context.goto_error:
            raise Exception("net::ERR_TIMED_OUT")
        self.url = self.context.redirect_to or self.context.fake.default_redirect_to or url

    def evaluate(self, script, arg=None):
        if arg is not None:
            # SESSION_STATE_JS: kembalikan marker sesuai setelan fake context.
            return {
                "authenticated": list(self.context.authenticated_markers),
                "unauthenticated": list(self.context.unauthenticated_markers),
            }
        return self.context.state

    def content(self):
        return self.context.html

    def query_selector(self, selector):
        if selector == 'input[type="password"]' and self.context.password_input:
            return object()
        return None

    def fill(self, *args, **kwargs):  # pragma: no cover - harus tidak pernah dipanggil
        self.context.events.append(("fill", args))

    def click(self, *args, **kwargs):  # pragma: no cover - harus tidak pernah dipanggil
        self.context.events.append(("click", args))

    def on(self, event, handler=None):
        pass

    def remove_listener(self, event, handler=None):
        pass

    def close(self):
        self.closed = True
        self.context.closed_pages += 1


class _FakeStatePage:
    """Page stub whose evaluate() walks a fixed list of states (for _wait_for_page_state)."""

    def __init__(self, states):
        self.states = states
        self.calls = 0

    def evaluate(self, script):
        self.calls += 1
        return self.states[min(self.calls - 1, len(self.states) - 1)]


class FakeContext:
    def __init__(self, fake):
        self.fake = fake
        self.events = fake.events
        self.state = fake.default_state
        self.html = relay_html()
        self.goto_error = None
        self.redirect_to = None
        self.closed_pages = 0
        self.closed = False
        self.password_input = fake.default_password_input
        self.authenticated_markers: list[str] = list(fake.default_authenticated_markers)
        self.unauthenticated_markers: list[str] = list(fake.default_unauthenticated_markers)

    def new_page(self):
        return FakePage(self)

    def close(self):
        self.closed = True
        self.events.append(("context_close",))


class FakeBrowser:
    def __init__(self, fake):
        self.fake = fake
        self.closed = False

    def new_context(self, **options):
        self.fake.last_context_options = options
        return FakeContext(self.fake)

    def close(self):
        self.closed = True
        self.fake.events.append(("browser_close",))


class FakeChromium:
    def __init__(self, fake):
        self.fake = fake

    def launch(self, headless=None, args=None):
        self.fake.events.append(("launch", args))
        if self.fake.launch_error:
            raise Exception("executable not found")
        return FakeBrowser(self.fake)

    def launch_persistent_context(self, profile, headless=None, args=None, **options):
        self.fake.events.append(("launch_persistent", profile, args, options))
        if self.fake.launch_error:
            raise Exception("profile locked")
        return FakeContext(self.fake)


class FakePlaywright:
    def __init__(self, fake):
        self.fake = fake
        self.chromium = FakeChromium(fake)
        self.stopped = False

    def stop(self):
        self.stopped = True
        self.fake.events.append(("playwright_stop",))


class FakePlaywrightWorld:
    def __init__(self):
        self.events: list = []
        self.launch_error = None
        self.last_context_options = None
        self.default_state = "relay"
        self.default_unauthenticated_markers: list[str] = []
        self.default_authenticated_markers: list[str] = []
        self.default_password_input = False
        self.default_redirect_to = None
        self.playwright = FakePlaywright(self)


def install_fake(monkeypatch, profile: str | None) -> FakePlaywrightWorld:
    fake = FakePlaywrightWorld()
    fake_module = types.ModuleType("playwright.sync_api")
    fake_module.sync_playwright = lambda: types.SimpleNamespace(start=lambda: fake.playwright)
    monkeypatch.setitem(sys.modules, "playwright", types.ModuleType("playwright"))
    monkeypatch.setitem(sys.modules, "playwright.sync_api", fake_module)
    monkeypatch.setattr(settings, "threads_browser_profile", profile)
    return fake


def test_profile_launches_persistent_context(monkeypatch, tmp_path):
    profile = str(tmp_path / "prof")
    fake = install_fake(monkeypatch, profile)
    session = BrowserSession()
    session.start()
    assert session.context is not None
    assert session.browser is None
    assert ("launch_persistent", profile, ["--disable-quic"], session.context_options()) in fake.events


def test_without_profile_launches_browser(monkeypatch):
    fake = install_fake(monkeypatch, None)
    session = BrowserSession()
    session.fetch(URL)
    assert ("launch", ["--disable-quic"]) in fake.events
    assert fake.last_context_options is not None


def test_persistent_context_reused_across_fetches(monkeypatch, tmp_path):
    fake = install_fake(monkeypatch, str(tmp_path / "prof"))
    session = BrowserSession()
    session.fetch(URL)
    session.fetch(URL)
    persistent = [event for event in fake.events if event[0] == "launch_persistent"]
    assert len(persistent) == 1
    assert session.context.closed is False


def test_locale_id_sent(monkeypatch):
    fake = install_fake(monkeypatch, None)
    BrowserSession().fetch(URL)
    assert fake.last_context_options["locale"] == "id-ID"


def test_timezone_sent(monkeypatch):
    fake = install_fake(monkeypatch, None)
    BrowserSession().fetch(URL)
    assert fake.last_context_options["timezone_id"] == "Asia/Jakarta"


def test_accept_language_header_sent(monkeypatch):
    fake = install_fake(monkeypatch, None)
    BrowserSession().fetch(URL)
    headers = fake.last_context_options["extra_http_headers"]
    assert headers["Accept-Language"] == "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"


def test_redirect_to_login_raises(monkeypatch):
    fake = install_fake(monkeypatch, None)
    fake.default_redirect_to = "https://www.threads.com/login"
    with pytest.raises(ThreadsError) as exc_info:
        BrowserSession().fetch(URL)
    assert exc_info.value.code == ThreadsErrorCode.LOGIN_REQUIRED
    assert exc_info.value.status_code == 403


def test_empty_state_returned(monkeypatch):
    fake = install_fake(monkeypatch, None)
    fake.default_state = "empty"
    # Sesi dipercaya -> 'empty' memang keyword tanpa hasil (bukan SESSION_DEGRADED).
    fake.default_authenticated_markers = list(client_module.AUTHENTICATED_MARKERS)
    page = BrowserSession().fetch(URL)
    assert isinstance(page, FetchedPage)
    assert page.page_state == "empty"
    assert page.rendered is True


def test_relay_state_returned(monkeypatch):
    install_fake(monkeypatch, None)
    page = BrowserSession().fetch(URL)
    assert page.page_state == "relay"
    assert "searchResults" in page.html


def test_loading_state_returned_after_wait(monkeypatch):
    fake = install_fake(monkeypatch, None)
    fake.default_state = "loading"
    monkeypatch.setattr(settings, "threads_content_wait", 0.1)
    monkeypatch.setattr(client_module.time, "sleep", lambda delay: None)
    page = BrowserSession().fetch(URL)
    assert page.page_state == "loading"


def test_challenge_raises_non_retryable(monkeypatch):
    fake = install_fake(monkeypatch, None)
    fake.default_state = "challenge"
    with pytest.raises(ThreadsError) as exc_info:
        BrowserSession().fetch(URL)
    assert exc_info.value.code == ThreadsErrorCode.CHALLENGE
    assert exc_info.value.status_code == 503
    assert exc_info.value.retryable is False


def test_page_closed_but_persistent_context_kept(monkeypatch, tmp_path):
    install_fake(monkeypatch, str(tmp_path / "prof"))
    session = BrowserSession()
    session.fetch(URL)
    assert session.context.closed_pages == 1
    assert session.context.closed is False


def test_profile_not_deleted_on_close(monkeypatch, tmp_path):
    profile = tmp_path / "prof"
    profile.mkdir()
    install_fake(monkeypatch, str(profile))
    session = BrowserSession()
    session.fetch(URL)
    session.close()
    assert profile.exists()


def test_worker_shutdown_closes_context_and_playwright(monkeypatch):
    fake = install_fake(monkeypatch, None)
    worker = BrowserWorker()
    worker.call(worker.session.fetch, URL)
    worker.stop()
    assert ("playwright_stop",) in fake.events
    assert ("browser_close",) in fake.events
    assert not worker._thread.is_alive()


def test_launch_failure_raises_render_failed_and_cleans_up(monkeypatch, tmp_path):
    fake = install_fake(monkeypatch, str(tmp_path / "prof"))
    fake.launch_error = True
    session = BrowserSession()
    with pytest.raises(ThreadsError) as exc_info:
        session.start()
    assert exc_info.value.code == ThreadsErrorCode.RENDER_FAILED
    assert exc_info.value.retryable is True
    assert exc_info.value.status_code == 503
    assert session.playwright is None
    assert session.context is None


def test_ephemeral_context_closed_per_fetch(monkeypatch):
    fake = install_fake(monkeypatch, None)
    session = BrowserSession()
    session.fetch(URL)
    assert ("context_close",) in fake.events
    assert session.browser.closed is False


def test_proxy_in_context_options_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "threads_proxy_server", "http://proxy.example:8080")
    monkeypatch.setattr(settings, "threads_proxy_username", "proxyuser")
    monkeypatch.setattr(settings, "threads_proxy_password", "proxypass")
    options = BrowserSession().context_options()
    assert options["proxy"] == {
        "server": "http://proxy.example:8080",
        "username": "proxyuser",
        "password": "proxypass",
    }


def test_no_proxy_in_context_options_when_unset(monkeypatch):
    monkeypatch.setattr(settings, "threads_proxy_server", None)
    options = BrowserSession().context_options()
    assert "proxy" not in options


def test_empty_final_only_when_search_request_settles(monkeypatch):
    # 'empty' harus ditahan selama ada request data search in-flight (count=1),
    # lalu final begitu count turun ke 0 — konfirmasi network-idle.
    monkeypatch.setattr(settings, "threads_content_wait", 10.0)
    monkeypatch.setattr(client_module.time, "sleep", lambda delay: None)
    page = _FakeStatePage(["empty"])
    counts = iter([1, 0])
    state = client_module._wait_for_page_state(page, lambda: next(counts, 0))
    assert state == "empty"
    assert page.calls == 2


def test_ensure_login_noop_without_credentials(monkeypatch):
    # Tanpa CRAWLER_THREADS_USERNAME, ensure_login harus no-op tanpa launch browser.
    monkeypatch.setattr(settings, "threads_username", None)
    session = BrowserSession()
    session.ensure_login()
    assert session.playwright is None
    assert session._logged_in is False


def test_ensure_login_skips_when_already_logged_in(monkeypatch):
    monkeypatch.setattr(settings, "threads_username", "u")
    session = BrowserSession()
    session._logged_in = True
    session.ensure_login()
    assert session.playwright is None


def test_empty_page_without_trusted_session_raises_session_degraded(monkeypatch):
    """Halaman search normal + kosong + tombol login = sesi degraded, bukan 'no results'."""
    fake = install_fake(monkeypatch, None)
    fake.default_state = "empty"
    fake.default_unauthenticated_markers = ['[aria-label="Login"]']
    with pytest.raises(ThreadsError) as exc_info:
        BrowserSession().fetch(URL)
    assert exc_info.value.code == ThreadsErrorCode.SESSION_DEGRADED
    assert exc_info.value.retryable is True


def test_empty_page_with_trusted_session_is_not_degraded(monkeypatch):
    """Marker positif hadir -> 'empty' memang keyword tanpa hasil, bukan degraded."""
    fake = install_fake(monkeypatch, None)
    fake.default_state = "empty"
    fake.default_authenticated_markers = ['[data-x="compose"]']
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", ['[data-x="compose"]'])
    page = BrowserSession().fetch(URL)
    assert page.page_state == "empty"
    assert page.session_trusted is True


def test_session_trust_undecided_when_no_markers_configured(monkeypatch):
    fake = install_fake(monkeypatch, None)
    fake.default_state = "empty"
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", [])
    page = BrowserSession().fetch(URL)
    assert page.session_trusted is None
    assert page.page_state == "empty"


def test_ensure_login_never_submits_credentials(monkeypatch):
    """Kredensial tidak pernah diisi/di-submit — login wajib manual (anti-2FA-trigger)."""
    fake = install_fake(monkeypatch, None)
    monkeypatch.setattr(settings, "threads_username", "u")
    monkeypatch.setattr(settings, "threads_password", "p")
    fake.default_unauthenticated_markers = ['[aria-label="Login"]']
    session = BrowserSession()
    with pytest.raises(ThreadsError) as exc_info:
        session.ensure_login()
    assert exc_info.value.code == ThreadsErrorCode.LOGIN_REQUIRED
    assert not [event for event in fake.events if event[0] in {"fill", "click"}]
    assert session._logged_in is False


def test_ensure_login_raises_on_hard_login_wall(monkeypatch):
    fake = install_fake(monkeypatch, None)
    monkeypatch.setattr(settings, "threads_username", "u")
    fake.default_password_input = True
    fake.default_redirect_to = "https://www.threads.com/login"
    with pytest.raises(ThreadsError) as exc_info:
        BrowserSession().ensure_login()
    assert exc_info.value.code == ThreadsErrorCode.LOGIN_REQUIRED
    assert not [event for event in fake.events if event[0] in {"fill", "click"}]


def test_ensure_login_accepts_trusted_session(monkeypatch):
    fake = install_fake(monkeypatch, None)
    monkeypatch.setattr(settings, "threads_username", "u")
    fake.default_authenticated_markers = ['[data-x="compose"]']
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", ['[data-x="compose"]'])
    session = BrowserSession()
    session.ensure_login()
    assert session._logged_in is True


def test_ensure_login_does_not_block_when_markers_undecided(monkeypatch):
    """AUTHENTICATED_MARKERS kosong + tidak ada tombol login -> crawl tetap jalan."""
    install_fake(monkeypatch, None)
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", [])
    monkeypatch.setattr(settings, "threads_username", "u")
    session = BrowserSession()
    session.ensure_login()
    assert session._logged_in is True


def test_configured_markers_are_valid_css():
    """':text()' dkk (pseudo Playwright) akan dilempar querySelector -> marker mati diam."""
    import re

    for selector in (
        *client_module.AUTHENTICATED_MARKERS,
        *client_module.UNAUTHENTICATED_MARKERS,
    ):
        assert not re.search(r":(text|has-text|visible)\b", selector), selector


def test_real_markers_detect_logged_in_session(monkeypatch):
    """Marker produksi (href /insights/ dan /saved/) menandai sesi tepercaya."""
    fake = install_fake(monkeypatch, None)
    fake.default_state = "articles"
    fake.default_authenticated_markers = ['a[href="/insights/"]']
    page = BrowserSession().fetch(URL)
    assert page.session_trusted is True
    assert page.session_markers == ('a[href="/insights/"]',)


def test_probe_waits_for_positive_marker_before_giving_up(monkeypatch):
    """Shell logged-out yang muncul sesaat tidak boleh divonis LOGIN_REQUIRED."""
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", ['a[href="/insights/"]'])
    monkeypatch.setattr(time, "sleep", lambda _s: None)

    class FlappingPage:
        """Dua polling pertama terlihat logged out, lalu nav akun muncul."""

        def __init__(self):
            self.calls = 0

        def evaluate(self, script, arg=None):
            self.calls += 1
            if self.calls <= 2:
                return {"authenticated": [], "unauthenticated": ['[aria-label="Login"]']}
            return {"authenticated": ['a[href="/insights/"]'], "unauthenticated": []}

        def query_selector(self, selector):
            return None

    trusted, markers = BrowserSession._probe_session(FlappingPage())
    assert trusted is True
    assert markers == ('a[href="/insights/"]',)


def test_probe_reports_logged_out_after_deadline(monkeypatch):
    monkeypatch.setattr(client_module, "AUTHENTICATED_MARKERS", ['a[href="/insights/"]'])
    monkeypatch.setattr(settings, "threads_content_wait", 0.01)
    monkeypatch.setattr(time, "sleep", lambda _s: None)

    class LoggedOutPage:
        def evaluate(self, script, arg=None):
            return {"authenticated": [], "unauthenticated": ['[aria-label="Login"]']}

        def query_selector(self, selector):
            return None

    trusted, markers = BrowserSession._probe_session(LoggedOutPage())
    assert trusted is False
    assert markers == ('[aria-label="Login"]',)
