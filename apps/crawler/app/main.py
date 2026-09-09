from __future__ import annotations

from fastapi import FastAPI, HTTPException
from structlog import get_logger

from app.exceptions import CrawlerError
from app.pipelines.dedupe import dedupe
from app.pipelines.normalize import normalize
from app.pipelines.relevance import affiliate_score, relevance_score
from app.queue.jobs import CrawlJobRequest
from app.spiders.threads.search_spider import threads_search

log = get_logger()

app = FastAPI(title="Threads Crawler")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/crawl")
def crawl(job: CrawlJobRequest) -> dict:
    try:
        raw = threads_search(job.keyword, job.limit)
    except CrawlerError as exc:
        log.warning("crawl_failed", keyword=job.keyword, reason=str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    posts = dedupe([normalize(item) for item in raw])[: job.limit]
    for post in posts:
        post.relevance_score = relevance_score(job.keyword, post)
        post.affiliate_score = affiliate_score(post)
    return {"posts": [post.model_dump(by_alias=True) for post in posts]}
