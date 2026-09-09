from pathlib import Path

import pytest

from app.exceptions import CrawlerError
from app.platforms.threads.parser import detect_login_wall, parse_threads_html, to_int

FIXTURE = Path(__file__).parent / "fixtures" / "thread_search.html"


def test_to_int():
    assert to_int("1.2K") == 1200
    assert to_int("45") == 45
    assert to_int("2M") == 2_000_000
    assert to_int("1,234") == 1234
    assert to_int(None) == 0
    assert to_int("abc") == 0


def test_parse_articles_fixture():
    posts = parse_threads_html(FIXTURE.read_text())
    assert len(posts) == 3
    first = posts[0]
    assert first["external_id"] == "abc123"
    assert first["source_url"].endswith("/post/abc123")
    assert first["author_username"] == "jane.doe"
    assert first["author_display_name"] == "Jane Doe"
    assert first["author_avatar_url"] == "https://cdn.avatar.jpg"
    assert "ref=aff" in first["content"]
    assert first["like_count"] == 1200
    assert first["reply_count"] == 45
    assert first["repost_count"] == 3
    assert first["media_urls"] == []


def test_parse_next_data():
    html = """<html><body><script id="__NEXT_DATA__" type="application/json">
    {"props":{"feed":[
      {"text":"hello world","likeCount":42,"replyCount":7,"repostCount":1,"id":"xyz",
       "permalink":"https://www.threads.net/@a/post/xyz",
       "author":{"username":"a","name":"A","profilePictureUri":"https://x/a.jpg"},
       "media":[{"uri":"https://x/m.jpg"}]},
      {"text":"second","likeCount":5,"id":"y"}
    ]}}
    </script></body></html>"""
    posts = parse_threads_html(html)
    assert [p["external_id"] for p in posts] == ["xyz", "y"]
    assert posts[0]["like_count"] == 42
    assert posts[0]["author_username"] == "a"
    assert posts[0]["media_urls"] == ["https://x/m.jpg"]
    assert posts[1]["source_url"] == "https://www.threads.net/post/y"


def test_login_wall_raises():
    with pytest.raises(CrawlerError, match="login wall"):
        parse_threads_html("<html><body><div>Log in to continue</div></body></html>")


def test_detect_login_wall():
    assert detect_login_wall("<p>Please log in to continue</p>")
    assert not detect_login_wall("<p>hello</p>")
