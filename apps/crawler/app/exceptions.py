class CrawlerError(Exception):
    """Raised when a crawl cannot complete (network, login wall, parse failure)."""


class ThreadsErrorCode:
    LOGIN_REQUIRED = "THREADS_LOGIN_REQUIRED"
    NO_RESULTS = "THREADS_NO_RESULTS"
    PARSE_ERROR = "THREADS_PARSE_ERROR"
    REQUEST_FAILED = "THREADS_REQUEST_FAILED"
    RENDER_FAILED = "THREADS_RENDER_FAILED"
    CHALLENGE = "THREADS_CHALLENGE"
    UNSUPPORTED_STRUCTURE = "THREADS_UNSUPPORTED_STRUCTURE"


class ThreadsError(CrawlerError):
    """Threads-specific failure with an explicit machine-readable code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        status_code: int = 502,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code
