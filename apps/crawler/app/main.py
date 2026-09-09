from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from structlog import get_logger

from app.exceptions import CrawlerError, ThreadsError, ThreadsErrorCode
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


@app.post("/crawl", response_model=None)
def crawl(job: CrawlJobRequest) -> dict | JSONResponse:
    try:
        raw = threads_search(job.keyword, job.limit)
    except ThreadsError as exc:
        log.warning(
            "crawl_failed",
            keyword=job.keyword,
            code=exc.code,
            reason=exc.message,
            retryable=exc.retryable,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, "retryable": exc.retryable},
        )
    except CrawlerError as exc:
        log.warning("crawl_failed", keyword=job.keyword, reason=str(exc))
        return JSONResponse(
            status_code=502,
            content={
                "code": ThreadsErrorCode.REQUEST_FAILED,
                "message": str(exc),
                "retryable": True,
            },
        )
    posts = dedupe([normalize(item) for item in raw])[: job.limit]
    for post in posts:
        post.relevance_score = relevance_score(job.keyword, post)
        post.affiliate_score = affiliate_score(post)
    return {
        "posts": [post.model_dump(by_alias=True) for post in posts],
        "meta": {"keyword": job.keyword, "total": len(posts)},
    }
