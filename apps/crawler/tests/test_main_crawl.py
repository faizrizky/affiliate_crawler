import structlog.testing
from fastapi.testclient import TestClient

import app.main as main_module


def test_crawl_skips_invalid_posts(monkeypatch):
    valid = {"external_id": "1", "author_username": "u", "content": "hi", "source_url": "https://x/1"}
    # missing required author_username + source_url -> ValidationError; content holds a marker to prove it is not logged
    bad = {"external_id": "2", "content": "SECRET_LEAK"}

    monkeypatch.setattr(main_module, "threads_search", lambda keyword, limit=20: [valid, bad])

    client = TestClient(main_module.app)
    with structlog.testing.capture_logs() as logs:
        response = client.post("/crawl", json={"keyword": "gatal", "limit": 20})

    assert response.status_code == 200
    data = response.json()
    assert data["meta"]["total"] == 1
    assert data["posts"][0]["externalId"] == "1"
    assert data["posts"][0]["content"] == "hi"

    failed = [entry for entry in logs if entry.get("event") == "crawl_normalize_failed"]
    assert len(failed) == 1
    assert failed[0]["keys"] == ["content", "external_id"]
    # keys are logged, but the raw content value must not leak
    assert "SECRET_LEAK" not in str(failed[0])
