from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from structlog import get_logger

from app.config.settings import settings
from app.exceptions import CrawlerError, ThreadsError, ThreadsErrorCode
from app.pipelines.dedupe import dedupe
from app.pipelines.normalize import normalize
from app.pipelines.relevance import affiliate_score, relevance_score
from app.platforms.threads.client import fetch_own_posts, shutdown_browser
from app.platforms.threads import socks_relay
from app.queue.jobs import CrawlJobRequest
from app.spiders.threads.search_spider import threads_search

log = get_logger()


def _check_profile() -> None:
    profile = settings.threads_browser_profile
    if not profile:
        return
    if not os.path.isdir(profile):
        raise RuntimeError(
            f"Threads browser profile directory does not exist: {profile}. "
            "Provision a logged-in profile before starting the crawler."
        )
    if not os.listdir(profile):
        raise RuntimeError(
            f"Threads browser profile directory is empty: {profile}. "
            "Provision a logged-in profile before starting the crawler."
        )
    log.info("threads_profile_ready", profile=profile)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _check_profile()
    if settings.threads_proxy_server:
        socks_relay.start(settings.threads_proxy_server)
    yield
    socks_relay.stop()
    shutdown_browser()


app = FastAPI(title="Threads Crawler", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "browser_profile": settings.threads_browser_profile,
        "browser_locale": settings.threads_browser_locale,
        "browser_timezone": settings.threads_browser_timezone,
        "accept_language": settings.threads_accept_language,
    }


class ProfileCrawlRequest(BaseModel):
    last_hours: int = 24
    limit: int = 30


@app.post("/crawl/profile/{username}", response_model=None)
def crawl_profile(username: str, req: ProfileCrawlRequest) -> dict | JSONResponse:
    """Baca post terbaru di sebuah profil — dipakai job auto-publish di API.

    Read-only: tidak pernah menulis, membalas, atau mengirim apa pun ke Threads.
    """
    username = (username or settings.threads_username or "").lstrip("@")
    if not username:
        return JSONResponse(
            status_code=400,
            content={
                "code": ThreadsErrorCode.REQUEST_FAILED,
                "message": "username tidak diset (CRAWLER_THREADS_USERNAME kosong)",
                "retryable": False,
            },
        )
    try:
        posts = fetch_own_posts(username, req.limit, req.last_hours)
    except ThreadsError as exc:
        log.warning(
            "own_posts_failed",
            username=username,
            code=exc.code,
            reason=exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, "retryable": exc.retryable},
        )
    return {"username": username, "posts": posts}


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
    normalized = []
    for item in raw:
        try:
            normalized.append(normalize(item))
        except ValidationError as exc:
            log.warning(
                "crawl_normalize_failed",
                keyword=job.keyword,
                keys=sorted(item.keys()) if isinstance(item, dict) else None,
                reason="; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['type']}" for e in exc.errors()),
            )
    posts = dedupe(normalized)
    for post in posts:
        post.relevance_score = relevance_score(job.keyword, post)
        post.affiliate_score = affiliate_score(post)
    posts.sort(key=lambda post: post.relevance_score, reverse=True)
    posts = posts[: job.limit]
    return {
        "posts": [post.model_dump(by_alias=True) for post in posts],
        "meta": {"keyword": job.keyword, "total": len(posts)},
    }
