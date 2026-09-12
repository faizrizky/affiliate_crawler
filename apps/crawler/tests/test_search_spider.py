import pytest

import app.spiders.threads.search_spider as spider
from app.config.settings import settings
from app.exceptions import ThreadsError, ThreadsErrorCode
from app.platforms.threads.client import FetchedPage

POST = '{"node":{"thread":{"thread_items":[{"post":{"id":"123","code":"abc","user":{"username":"u"},"caption":{"text":"hi"}}}]}}}'


def relay_html(edges: str) -> str:
    return f'<html><body><script type="application/json">{{"searchResults":{{"edges":{edges}}}}}</script></body></html>'


def make_page(html: str) -> FetchedPage:
    return FetchedPage(
        html=html,
        final_url="https://www.threads.com/search?q=x",
        status_code=200,
        rendered=True,
        page_state="relay",
    )


def run_search(monkeypatch, pages, attempts=3, backoff=1.0):
    calls = {"fetch": 0, "sleeps": []}

    def fake_fetch(keyword):
        calls["fetch"] += 1
        item = pages[calls["fetch"] - 1]
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(spider, "fetch_search_page", fake_fetch)
    monkeypatch.setattr("time.sleep", lambda delay: calls["sleeps"].append(delay))
    monkeypatch.setattr(settings, "threads_search_attempts", attempts)
    monkeypatch.setattr(settings, "threads_retry_backoff_seconds", backoff)
    return calls


def test_success_first_attempt(monkeypatch):
    calls = run_search(monkeypatch, [make_page(relay_html(f"[{POST}]"))])
    posts = spider.threads_search("gatal")
    assert calls["fetch"] == 1
    assert calls["sleeps"] == []
    assert [p["external_id"] for p in posts] == ["123"]


def test_confirmed_zero_single_fetch(monkeypatch):
    calls = run_search(monkeypatch, [make_page(relay_html("[]"))])
    assert spider.threads_search("xkqzjvwrt98765") == []
    assert calls["fetch"] == 1
    assert calls["sleeps"] == []


def test_login_wall_no_retry(monkeypatch):
    calls = run_search(monkeypatch, [make_page("<html><body><div>Log in to continue</div></body></html>")])
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.LOGIN_REQUIRED
    assert exc_info.value.status_code == 403
    assert calls["fetch"] == 1
    assert calls["sleeps"] == []


def test_login_error_no_retry(monkeypatch):
    calls = run_search(monkeypatch, [ThreadsError(ThreadsErrorCode.LOGIN_REQUIRED, "redirected", status_code=403)])
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.LOGIN_REQUIRED
    assert calls["fetch"] == 1
    assert calls["sleeps"] == []


def test_ambiguous_then_success(monkeypatch):
    pages = [
        make_page("<html><body><div>loading</div></body></html>"),
        make_page(relay_html(f"[{POST}]")),
    ]
    calls = run_search(monkeypatch, pages)
    posts = spider.threads_search("gatal")
    assert calls["fetch"] == 2
    assert [p["external_id"] for p in posts] == ["123"]
    assert calls["sleeps"] == [1.0]


def test_transient_fetch_error_then_success(monkeypatch):
    pages = [
        ThreadsError(ThreadsErrorCode.REQUEST_FAILED, "timeout", retryable=True),
        make_page(relay_html(f"[{POST}]")),
    ]
    calls = run_search(monkeypatch, pages)
    posts = spider.threads_search("gatal")
    assert calls["fetch"] == 2
    assert [p["external_id"] for p in posts] == ["123"]
    assert calls["sleeps"] == [1.0]


def test_non_retryable_error_raises_immediately(monkeypatch):
    calls = run_search(monkeypatch, [ThreadsError(ThreadsErrorCode.RENDER_FAILED, "challenge", status_code=503)])
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.RENDER_FAILED
    assert calls["fetch"] == 1
    assert calls["sleeps"] == []


def test_exhaustion_raises_ambiguous(monkeypatch):
    pages = [make_page("<html><body><div>loading</div></body></html>")] * 3
    calls = run_search(monkeypatch, pages)
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.UNSUPPORTED_STRUCTURE
    assert exc_info.value.retryable
    assert calls["fetch"] == 3
    assert calls["sleeps"] == [1.0, 2.0]


def test_limit_respected(monkeypatch):
    edges = ",".join(
        '{"node":{"thread":{"thread_items":[{"post":{"id":"p%d","caption":{"text":"hi"}}}]}}}' % index
        for index in range(5)
    )
    run_search(monkeypatch, [make_page(relay_html(f"[{edges}]"))])
    assert len(spider.threads_search("gatal", limit=3)) == 3


def test_multitext_phrase_fallback_to_first_word(monkeypatch):
    pages = [
        make_page(relay_html("[]")),
        make_page(relay_html(f"[{POST}]")),
    ]
    calls = run_search(monkeypatch, pages)
    posts = spider.threads_search("toner kulit kering")
    assert calls["fetch"] == 2
    assert [p["external_id"] for p in posts] == ["123"]
    assert calls["sleeps"] == []


def test_multitext_phrase_no_fallback_when_results(monkeypatch):
    run_search(monkeypatch, [make_page(relay_html(f"[{POST}]"))])
    posts = spider.threads_search("toner kulit kering")
    assert [p["external_id"] for p in posts] == ["123"]


def test_multitext_phrase_fallback_empty_stays_empty(monkeypatch):
    calls = run_search(monkeypatch, [make_page(relay_html("[]"))] * 2)
    assert spider.threads_search("toner kulit kering") == []
    assert calls["fetch"] == 2


def test_proxy_server_logged_not_credentials(monkeypatch):
    from structlog.testing import capture_logs

    run_search(monkeypatch, [make_page(relay_html(f"[{POST}]"))])
    monkeypatch.setattr(settings, "threads_proxy_server", "http://proxy.example:8080")
    monkeypatch.setattr(settings, "threads_proxy_username", "proxyuser")
    monkeypatch.setattr(settings, "threads_proxy_password", "proxypass")
    with capture_logs() as logs:
        spider.threads_search("gatal")
    attempt_logs = [entry for entry in logs if entry["event"] == "threads_search_attempt"]
    assert attempt_logs
    for entry in attempt_logs:
        assert entry["proxy_server"] == "http://proxy.example:8080"
        flat = " ".join(str(value) for value in entry.values())
        assert "proxyuser" not in flat
        assert "proxypass" not in flat


def degraded_page(html: str) -> FetchedPage:
    page = make_page(html)
    page.session_trusted = False
    page.session_markers = ('[aria-label="Login"]',)
    return page


def session_degraded_error() -> ThreadsError:
    return ThreadsError(
        ThreadsErrorCode.SESSION_DEGRADED,
        "degraded",
        retryable=True,
        status_code=403,
    )


def test_session_degraded_from_fetch_retries_once_then_raises(monkeypatch):
    calls = run_search(
        monkeypatch,
        [session_degraded_error(), session_degraded_error(), session_degraded_error()],
    )
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.SESSION_DEGRADED
    # 1 percobaan + 1 retry, tidak sampai attempts(3)
    assert calls["fetch"] == 2
    assert len(calls["sleeps"]) == 1


def test_session_degraded_recovers_on_retry(monkeypatch):
    calls = run_search(
        monkeypatch,
        [session_degraded_error(), make_page(relay_html(f"[{POST}]"))],
    )
    posts = spider.threads_search("gatal")
    assert [p["external_id"] for p in posts] == ["123"]
    assert calls["fetch"] == 2


def test_empty_page_untrusted_session_raises_instead_of_empty_list(monkeypatch):
    """Sesi tidak dipercaya + nol hasil tidak boleh diam-diam jadi []."""
    calls = run_search(
        monkeypatch,
        [degraded_page(relay_html("[]")), degraded_page(relay_html("[]"))],
    )
    with pytest.raises(ThreadsError) as exc_info:
        spider.threads_search("gatal")
    assert exc_info.value.code == ThreadsErrorCode.SESSION_DEGRADED
    assert calls["fetch"] == 2


def test_trusted_session_empty_still_returns_empty_list(monkeypatch):
    page = make_page(relay_html("[]"))
    page.session_trusted = True
    calls = run_search(monkeypatch, [page])
    assert spider.threads_search("xkqzjvwrt98765") == []
    assert calls["fetch"] == 1
