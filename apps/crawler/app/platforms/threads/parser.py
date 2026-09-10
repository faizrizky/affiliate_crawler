from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin

from structlog import get_logger

from app.platforms.threads.selectors import (
    ARTICLE_SELECTORS,
    CONTENT_MARKERS,
    EMPTY_RESULT_MARKERS,
    LOGIN_WALL_MARKERS,
)

log = get_logger()

NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*type="application/json"[^>]*>(.*?)</script>',
    re.S,
)
RELAY_SCRIPT_RE = re.compile(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', re.S)
SUFFIX_MULTIPLIERS = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
COUNT_RE = re.compile(r"^([\d.]+)\s*([KMB])?$", re.I)


@dataclass
class ParseResult:
    posts: list[dict] = field(default_factory=list)
    candidate_count: int = 0
    login_wall: bool = False
    empty_results: bool = False
    layer: str = "none"


def to_int(value: object) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    match = COUNT_RE.match(str(value).strip().replace(",", ""))
    if not match:
        return 0
    number = float(match.group(1))
    suffix = (match.group(2) or "").upper()
    return int(number * SUFFIX_MULTIPLIERS.get(suffix, 1))


def parse_threads_html(html: str) -> ParseResult:
    relay = _from_relay_json(html)
    if relay.layer == "relay_json":
        return relay
    result = _from_next_data(html)
    if result.posts:
        return result
    result = _from_articles(html)
    if result.posts:
        return result
    matched = [marker for marker in CONTENT_MARKERS if marker in html]
    if matched:
        log.debug(
            "threads_parse_no_posts_content",
            html_length=len(html),
            html_head=html[:500],
            content_markers=matched,
        )
    return ParseResult(
        login_wall=detect_login_wall(html),
        empty_results=detect_empty_results(html),
    )


def _visible_text(html: str) -> str:
    stripped = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    stripped = re.sub(r"<[^>]+>", " ", stripped)
    return re.sub(r"\s+", " ", stripped).lower()


def detect_login_wall(html: str) -> bool:
    visible = _visible_text(html)
    return any(marker in visible for marker in LOGIN_WALL_MARKERS)


def detect_empty_results(html: str) -> bool:
    visible = _visible_text(html)
    return any(marker in visible for marker in EMPTY_RESULT_MARKERS)


def _from_relay_json(html: str) -> ParseResult:
    for match in RELAY_SCRIPT_RE.finditer(html):
        raw = match.group(1)
        if '"searchResults"' not in raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            log.debug(
                "threads_relay_json_decode_failed",
                script_length=len(raw),
                position=exc.pos,
            )
            continue
        found = _find_search_results(data)
        if found is None:
            continue
        edges = found.get("edges")
        if not isinstance(edges, list):
            continue
        if not edges:
            return ParseResult(empty_results=True, layer="relay_json")
        posts = _map_relay_edges(edges)
        return ParseResult(posts=posts, candidate_count=len(edges), layer="relay_json")
    return ParseResult(layer="none")


def _find_search_results(node: object) -> dict | None:
    if isinstance(node, dict):
        value = node.get("searchResults")
        if isinstance(value, dict):
            return value
        for child in node.values():
            found = _find_search_results(child)
            if found is not None:
                return found
    elif isinstance(node, list):
        for item in node:
            found = _find_search_results(item)
            if found is not None:
                return found
    return None


def _map_relay_edges(edges: list) -> list[dict]:
    posts: list[dict] = []
    seen: set[str] = set()
    for edge in edges:
        for post in _relay_posts(edge):
            mapped = _from_relay_post(post)
            if mapped and mapped["external_id"] not in seen:
                seen.add(mapped["external_id"])
                posts.append(mapped)
    return posts


def _relay_posts(edge: object) -> list[dict]:
    if not isinstance(edge, dict):
        return []
    thread = (edge.get("node") or {}).get("thread")
    if not isinstance(thread, dict):
        return []
    posts = []
    for item in thread.get("thread_items") or []:
        if isinstance(item, dict) and isinstance(item.get("post"), dict):
            posts.append(item["post"])
    return posts


def _from_relay_post(post: dict) -> dict | None:
    code = post.get("code")
    post_id = post.get("id")
    if not code and not post_id:
        return None
    user = post.get("user") or {}
    username = str(user.get("username") or "")
    if code and username:
        source_url = f"https://www.threads.com/@{username}/post/{code}"
    else:
        source_url = f"https://www.threads.com/post/{post_id or code}"
    caption = post.get("caption") or {}
    content = str(caption.get("text") or "").strip()
    if not content:
        fragments = post.get("text_fragments") or []
        content = "".join(
            str(fragment.get("text", "")) for fragment in fragments if isinstance(fragment, dict)
        ).strip()
    info = post.get("text_post_app_info") or {}
    media_urls = _relay_media_urls(post)
    if not content and not media_urls:
        return None
    return {
        "external_id": str(post_id or code),
        "author_username": username,
        "author_display_name": user.get("full_name") or None,
        "author_avatar_url": user.get("profile_pic_url"),
        "content": content,
        "media_urls": media_urls,
        "like_count": to_int(post.get("like_count")),
        "reply_count": to_int(info.get("direct_reply_count")),
        "repost_count": to_int(info.get("repost_count")),
        "source_url": source_url,
        "published_at": _to_iso_utc(post.get("taken_at")),
    }


def _relay_media_urls(post: dict) -> list[str]:
    urls: list[str] = []

    def add(value: object) -> None:
        if isinstance(value, str) and value and value not in urls:
            urls.append(value)

    candidates = (post.get("image_versions2") or {}).get("candidates") or []
    if candidates and isinstance(candidates[0], dict):
        add(candidates[0].get("url"))
    for media in post.get("carousel_media") or []:
        if not isinstance(media, dict):
            continue
        image_candidates = (media.get("image_versions2") or {}).get("candidates") or []
        if image_candidates and isinstance(image_candidates[0], dict):
            add(image_candidates[0].get("url"))
        video_candidates = media.get("video_versions") or []
        if video_candidates and isinstance(video_candidates[0], dict):
            add(video_candidates[0].get("url"))
    video_versions = post.get("video_versions") or []
    if video_versions and isinstance(video_versions[0], dict):
        add(video_versions[0].get("url"))
    return urls


def _to_iso_utc(value: object) -> str | None:
    try:
        timestamp = float(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    return (
        datetime.fromtimestamp(timestamp, tz=timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _from_next_data(html: str) -> ParseResult:
    m = NEXT_DATA_RE.search(html)
    if not m:
        return ParseResult(layer="none")
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return ParseResult(layer="none")
    posts: list[dict] = []
    _walk(data, posts)
    deduped: list[dict] = []
    seen: set[str] = set()
    for post in posts:
        if post["external_id"] and post["external_id"] not in seen:
            seen.add(post["external_id"])
        deduped.append(post)
    if deduped:
        return ParseResult(posts=deduped, candidate_count=len(deduped), layer="next_data")
    return ParseResult(layer="none")


def _walk(node: object, posts: list[dict]) -> None:
    if isinstance(node, dict):
        if "id" in node and ("text" in node or "content" in node):
            posts.append(_from_next_data_item(node))
        for value in node.values():
            _walk(value, posts)
    elif isinstance(node, list):
        for item in node:
            _walk(item, posts)


def _from_next_data_item(item: dict) -> dict:
    item_id = str(item.get("id") or "")
    permalink = str(item.get("permalink") or "")
    if permalink:
        source_url = (
            permalink
            if permalink.startswith("http")
            else urljoin("https://www.threads.net/", permalink.lstrip("/"))
        )
    else:
        source_url = f"https://www.threads.net/post/{item_id}"
    author = item.get("author") or {}
    media_urls = [
        media.get("uri")
        for media in item.get("media") or []
        if isinstance(media, dict) and isinstance(media.get("uri"), str)
    ]
    return {
        "external_id": item_id or permalink.rsplit("/", 1)[-1],
        "author_username": str(author.get("username") or ""),
        "author_display_name": author.get("name") or author.get("full_name") or None,
        "author_avatar_url": author.get("profilePictureUri") or author.get("profile_pic"),
        "content": str(item.get("text") or item.get("content") or "").strip(),
        "media_urls": media_urls,
        "like_count": to_int(item.get("likeCount") or item.get("like_count")),
        "reply_count": to_int(item.get("replyCount") or item.get("reply_count")),
        "repost_count": to_int(item.get("repostCount") or item.get("repost_count")),
        "source_url": source_url,
    }


def _from_articles(html: str) -> ParseResult:
    from scrapling.parser import Adaptor

    page = Adaptor(html)
    elements = []
    for selector in ARTICLE_SELECTORS:
        elements = page.css(selector)
        if elements:
            break
    posts: list[dict] = []
    for article in elements:
        post = _parse_article(article)
        if post["external_id"] and post["content"]:
            posts.append(post)
    if posts:
        return ParseResult(posts=posts, candidate_count=len(posts), layer="articles")
    return ParseResult(layer="none")


def _parse_article(article: object) -> dict:
    def css_one(scope: object, selector: str) -> object:
        nodes = scope.css(selector)  # type: ignore[union-attr]
        return nodes[0] if nodes else None

    link = css_one(article, "a.permalink[href*='/post/']") or css_one(article, "a[href*='/post/']")
    permalink = link.attrib.get("href") if link is not None else None  # type: ignore[union-attr]
    external_id = str(permalink.rstrip("/").rsplit("/", 1)[-1]) if permalink else ""

    author_link = css_one(article, "a.author[href*='/@']") or css_one(article, "a[href*='/@']")
    username = (
        str(author_link.attrib.get("href")).strip("/").rsplit("@", 1)[-1].strip("/")  # type: ignore[union-attr]
        if author_link is not None
        else ""
    )
    display_name = None
    avatar_url = None
    author_img_srcs: set[str] = set()
    if author_link is not None:
        strong = author_link.css("strong")
        if strong:
            display_name = strong[0].get_all_text().strip() or None
        author_imgs = author_link.css("img")
        if author_imgs:
            avatar_url = author_imgs[0].attrib.get("src")
        author_img_srcs = {img.attrib.get("src") for img in author_imgs if img.attrib.get("src")}

    media_urls: list[str] = []
    for img in article.css("img[src]"):  # type: ignore[union-attr]
        src = img.attrib.get("src")
        if src and src not in media_urls and src not in author_img_srcs:
            media_urls.append(src)
    video = css_one(article, "video[src]")
    if video is not None:
        src = video.attrib.get("src")  # type: ignore[union-attr]
        if src and src not in media_urls:
            media_urls.append(src)

    def count(*needles: str) -> int:
        for el in article.css("span[aria-label]"):  # type: ignore[union-attr]
            label = str(el.attrib.get("aria-label") or "").lower()
            if any(needle in label for needle in needles):
                return to_int(el.get_all_text().strip() or label)
        return 0

    paragraphs = [
        p.get_all_text().strip()  # type: ignore[union-attr]
        for p in article.css("p")  # type: ignore[union-attr]
        if p.get_all_text().strip()  # type: ignore[union-attr]
    ]
    content = " ".join(paragraphs) or _all_text(article)

    return {
        "external_id": external_id,
        "author_username": username,
        "author_display_name": display_name,
        "author_avatar_url": avatar_url,
        "content": content,
        "media_urls": media_urls,
        "like_count": count("like"),
        "reply_count": count("repl"),
        "repost_count": count("repost"),
        "source_url": str(permalink) if permalink else "",
    }


def _all_text(node: object) -> str:
    text = node.get_all_text(ignore_tags=("script", "style"))  # type: ignore[union-attr]
    return " ".join(line.strip() for line in text.splitlines() if line.strip()).strip()
