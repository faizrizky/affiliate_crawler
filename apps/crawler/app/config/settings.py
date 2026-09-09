from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CRAWLER_")

    crawler_port: int = 8001
    user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
    request_timeout: float = 20.0
    threads_use_browser: bool = True
    threads_browser_profile: str | None = None
    threads_browser_timeout: float = 30.0
    threads_content_wait: float = 15.0


settings = Settings()
