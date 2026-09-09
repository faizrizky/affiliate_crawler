from __future__ import annotations

import json
import re
from urllib.parse import urljoin

from app.exceptions import CrawlerError
from app.platforms.threads.selectors import ARTICLE_SELECTORS, LOGIN_WALL_MARKERS

NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*type="application/json"[^>]*>(.*?)</script>',
    re.S,
)
SUFFIX_MULTIPLIERS = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
COUNT_RE = re.compile(r"^([\d.]+)\s*([KMB])?$", re.I)


def to_int(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    s = str(value).strip().replace(",", "")
    m = COUNT_RE.match(s)
    if not m:
        return 0
    n = float(m.group(1))
    suffix = m.group(2)
    if suffix:
        n *= SUFFIX_MULTIPLIERS[suffix.upper()]
    return int(n)


def detect_login_wall(html: str) -> bool:
    lowered = html.lower()
    return any(marker in lowered for marker in LOGIN_WALL_MARKERS)


def _all_text(el) -> str:
    return " ".join(el.get_all_text().split())


def parse_threads_html(html: str) -> list[dict]:
    posts = _from_next_data(html)
    if not posts:
        posts = _from_articles(html)
    if not posts and detect_login_wall(html):
        raise CrawlerError("Threads login wall detected")
    return posts


def _from_next_data(html: str) -> list[dict]:
    m = NEXT_DATA_RE.search(html)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []
    posts: list[dict] = []
    _walk(data, posts)
    return posts


def _walk(node: object, posts: list[dict]) -> None:
    if isinstance(node, dict):
        if (
            isinstance(node.get("text"), str)
            and ("likeCount" in node or "reactionsCount" in node)
            and ("id" in node or "permalink" in node)
        ):
            posts.append(_from_next_data_item(node))
        for value in node.values():
            _walk(value, posts)
    elif isinstance(node, list):
        for item in node:
            _walk(item, posts)


def _from_next_data_item(item: dict) -> dict:
    permalink = item.get("permalink") or f"https://www.threads.net/post/{item.get('id')}"
    return {
        "external_id": str(item.get("id") or permalink.rsplit("/", 1)[-1]),
        "author_username": str(
            (item.get("author") or {}).get("username") or item.get("author_username") or ""
        ),
        "author_display_name": (item.get("author") or {}).get("name"),
        "author_avatar_url": (item.get("author") or {}).get("profilePictureUri"),
        "content": item.get("text", ""),
        "media_urls": [
            m.get("uri")
            for m in item.get("media", [])
            if isinstance(m, dict) and m.get("uri")
        ],
        "like_count": to_int(item.get("likeCount") or item.get("reactionsCount")),
        "reply_count": to_int(item.get("replyCount")),
        "repost_count": to_int(item.get("repostCount") or item.get("shareCount")),
        "source_url": permalink,
    }


def _from_articles(html: str) -> list[dict]:
    from scrapling.parser import Adaptor

    page = Adaptor(html)
    elements = []
    for selector in ARTICLE_SELECTORS:
        elements = page.css(selector)
        if elements:
            break
    posts = []
    for article in elements:
        post = _parse_article(article)
        if post["external_id"] and post["content"]:
            posts.append(post)
    return posts


def _parse_article(article) -> dict:
    source_url = ""
    external_id = ""
    for link in article.css('a[href*="/post/"]'):
        href = link.attrib.get("href", "")
        if href:
            source_url = href if href.startswith("http") else urljoin(
                "https://www.threads.net", href
            )
            external_id = href.rstrip("/").rsplit("/", 1)[-1]
            break

    author_username = ""
    author_display_name = None
    author_avatar_url = None
    author_link = article.css("a[href*='@']") or article.css("a[class*='author']")
    if author_link:
        link = author_link[0]
        href = link.attrib.get("href", "")
        if href:
            author_username = href.rstrip("/").rsplit("/", 1)[-1].lstrip("@")
        display = link.css("strong") or link.css("span")
        if display:
            author_display_name = _all_text(display[0]) or None
        avatar = link.css("img")
        if avatar:
            author_avatar_url = avatar[0].attrib.get("src")

    paragraphs = article.css("p")
    parts = [_all_text(p) for p in paragraphs]
    content = " ".join(part for part in parts if part)
    if not content:
        content = _all_text(article)

    media_urls: list[str] = []
    for img in article.css("img"):
        src = img.attrib.get("src")
        if src and src != author_avatar_url and "avatar" not in src.lower():
            media_urls.append(src)
    for video in article.css("video"):
        src = video.attrib.get("src")
        if src:
            media_urls.append(src)

    like_count, reply_count, repost_count = 0, 0, 0
    for span in article.css("[aria-label]"):
        label = (span.attrib.get("aria-label") or "").lower()
        value = to_int(label.split(" ")[0] if label else None)
        if "like" in label:
            like_count = value
        elif "repl" in label:
            reply_count = value
        elif "repost" in label or "share" in label:
            repost_count = value

    return {
        "external_id": external_id,
        "author_username": author_username,
        "author_display_name": author_display_name,
        "author_avatar_url": author_avatar_url,
        "content": content,
        "media_urls": media_urls,
        "like_count": like_count,
        "reply_count": reply_count,
        "repost_count": repost_count,
        "source_url": source_url,
    }
