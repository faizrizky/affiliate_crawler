import httpx
import pytest

BASE_URL = "http://127.0.0.1:8001"


def test_repeated_search_is_stable():
    try:
        httpx.get(f"{BASE_URL}/health", timeout=3).raise_for_status()
    except Exception:
        pytest.skip("crawler tidak berjalan")
    counts = []
    for index in range(5):
        response = httpx.post(
            f"{BASE_URL}/crawl",
            json={"keyword": "Gatal", "limit": 20},
            timeout=180,
        )
        assert response.status_code == 200, (
            f"run {index + 1}: HTTP {response.status_code} {response.text[:200]}"
        )
        counts.append(len(response.json()["posts"]))
    assert not (any(c == 0 for c in counts) and any(c > 0 for c in counts)), f"flip 0/non-0: {counts}"
