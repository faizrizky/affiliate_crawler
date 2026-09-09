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
