from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CRAWLER_",
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
    )

    crawler_port: int = 8001
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
    request_timeout: float = 20.0
    threads_use_browser: bool = True
    threads_browser_profile: str | None = None
    threads_proxy_server: str | None = None
    threads_proxy_username: str | None = None
    threads_proxy_password: str | None = None
    # API-side CRAWLER_TIMEOUT (apps/api/src/config/env.validation.ts) harus >=
    # worst-case: threads_search_attempts × (threads_browser_timeout +
    # threads_content_wait) + backoff. Naikkan salah satu, cek yang lainnya.
    threads_browser_timeout: float = 30.0
    threads_content_wait: float = 15.0
    threads_search_attempts: int = 3
    threads_retry_backoff_seconds: float = 1.0
    threads_browser_locale: str = "id-ID"
    threads_browser_timezone: str = "Asia/Jakarta"
    threads_accept_language: str = "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"


settings = Settings()
