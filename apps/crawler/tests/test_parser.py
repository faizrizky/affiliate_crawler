from pathlib import Path

from app.platforms.threads.parser import (
    ParseResult,
    detect_empty_results,
    detect_login_wall,
    parse_threads_html,
    to_int,
)

FIXTURE = Path(__file__).parent / "fixtures" / "thread_search.html"


def test_to_int():
    assert to_int("1.2K") == 1200
    assert to_int("45") == 45
    assert to_int("2M") == 2_000_000
    assert to_int("1,234") == 1234
    assert to_int(None) == 0
    assert to_int("abc") == 0


def test_parse_articles_fixture():
    posts = parse_threads_html(FIXTURE.read_text()).posts
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
    posts = parse_threads_html(html).posts
    assert [p["external_id"] for p in posts] == ["xyz", "y"]
    assert posts[0]["like_count"] == 42
    assert posts[0]["author_username"] == "a"
    assert posts[0]["media_urls"] == ["https://x/m.jpg"]
    assert posts[1]["source_url"] == "https://www.threads.net/post/y"


def test_parse_relay_json():
    html = """<html><body><script type="application/json">
    {"searchResults":{"edges":[{"node":{"thread":{"code":"abc",
      "thread_items":[{"post":{"id":"123","code":"abc",
        "user":{"username":"u","full_name":"U","profile_pic_url":"https://x/u.jpg"},
        "caption":{"text":"hi there"},
        "taken_at":1700000000,
        "like_count":5,
        "text_post_app_info":{"direct_reply_count":1,"repost_count":2},
        "image_versions2":{"candidates":[{"url":"https://img/1.jpg"}]}}}]}}}]}}
    </script></body></html>"""
    result = parse_threads_html(html)
    assert result.layer == "relay_json"
    assert result.candidate_count == 1
    post = result.posts[0]
    assert post["external_id"] == "123"
    assert post["author_username"] == "u"
    assert post["content"] == "hi there"
    assert post["media_urls"] == ["https://img/1.jpg"]
    assert post["like_count"] == 5
    assert post["reply_count"] == 1
    assert post["repost_count"] == 2
    assert post["source_url"] == "https://www.threads.com/@u/post/abc"
    assert post["published_at"] == "2023-11-14T22:13:20Z"


def test_parse_relay_json_empty():
    html = '<script type="application/json">{"searchResults":{"edges":[]}}</script>'
    result = parse_threads_html(html)
    assert result.layer == "relay_json"
    assert result.empty_results
    assert result.posts == []


def test_login_wall_flag():
    result = parse_threads_html("<html><body><div>Log in to continue</div></body></html>")
    assert result.login_wall
    assert not result.posts


def test_empty_results_flag():
    result = parse_threads_html("<html><body>No results found</body></html>")
    assert result.empty_results
    assert not result.login_wall


def test_detect_login_wall():
    assert detect_login_wall("<p>Please log in to continue</p>")
    assert not detect_login_wall("<p>hello</p>")


def test_detect_empty_results():
    assert detect_empty_results("<p>No results</p>")
    assert not detect_empty_results("<p>some threads</p>")


def test_parse_result_defaults():
    result = ParseResult()
    assert result.posts == []
    assert result.layer == "none"


def test_detect_empty_ignores_script_content():
    html = '<html><head><script>var msg = "no results";</script></head><body><div>hello world</div></body></html>'
    assert not detect_empty_results(html)
    assert not parse_threads_html(html).empty_results


def test_detect_empty_indonesian_marker():
    assert detect_empty_results("<p>Tidak ada hasil</p>")
    result = parse_threads_html("<html><body>Tidak ada hasil untuk 'gatal'</body></html>")
    assert result.empty_results
    assert not result.posts


def test_detect_login_wall_ignores_script_content():
    html = '<html><head><script>log in to continue</script></head><body><div>hello world</div></body></html>'
    assert not detect_login_wall(html)
    assert not parse_threads_html(html).login_wall


def test_parse_relay_dedupes_posts():
    post = '{"id":"123","code":"abc","user":{"username":"u"},"caption":{"text":"hi"}}'
    edge = '{"node":{"thread":{"thread_items":[{"post":%s}]}}}' % post
    html = f'<script type="application/json">{{"searchResults":{{"edges":[{edge},{edge}]}}}}</script>'
    result = parse_threads_html(html)
    assert result.layer == "relay_json"
    assert [p["external_id"] for p in result.posts] == ["123"]


def test_parse_relay_skips_post_without_content_or_media():
    html = (
        '<script type="application/json">{"searchResults":{"edges":'
        '[{"node":{"thread":{"thread_items":[{"post":{"id":"999","user":{"username":"u"}}}]}}}]'
        "}}</script>"
    )
    result = parse_threads_html(html)
    assert result.layer == "relay_json"
    assert result.posts == []
    assert not result.empty_results


def test_parse_relay_float_taken_at():
    html = (
        '<script type="application/json">{"searchResults":{"edges":'
        '[{"node":{"thread":{"thread_items":[{"post":{"id":"123","caption":{"text":"hi"},"taken_at":"1700000000.5"}}]}}}]'
        "}}</script>"
    )
    post = parse_threads_html(html).posts[0]
    assert post["published_at"] == "2023-11-14T22:13:20Z"
