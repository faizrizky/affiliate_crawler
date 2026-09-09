from __future__ import annotations

import json
import sys

from app.platforms.threads.client import fetch_search_page
from app.platforms.threads.parser import parse_threads_html


def main() -> None:
    keyword = sys.argv[1] if len(sys.argv) > 1 else "sabun"
    page = fetch_search_page(keyword)
    result = parse_threads_html(page.html)
    sample = [
        {
            "external_id": post["external_id"],
            "author": post["author_username"],
            "content": post["content"][:120],
            "media": post["media_urls"][:2],
            "likes": post["like_count"],
            "published_at": post.get("published_at"),
            "source_url": post["source_url"],
        }
        for post in result.posts[:3]
    ]
    print(
        json.dumps(
            {
                "keyword": keyword,
                "final_url": page.final_url,
                "status_code": page.status_code,
                "rendered": page.rendered,
                "content_length": len(page.html),
                "layer": result.layer,
                "login_wall": result.login_wall,
                "empty_results": result.empty_results,
                "candidate_count": result.candidate_count,
                "parsed": len(result.posts),
                "sample": sample,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
