from __future__ import annotations

ARTICLE_SELECTORS = ["article[data-testid='thread']", "article"]

# Markers that confirm a page carries real search content (vs a blank or
# JavaScript-challenge page). Shared by the httpx fallback and parser-drift
# diagnostics.
CONTENT_MARKERS = ['"searchResults"', "__NEXT_DATA__", "<article", "data-testid"]

# Markers that indicate a wall replaced the content. Weak CTAs such as
# "Log in to Threads" also appear in the anonymous footer and are excluded.
LOGIN_WALL_MARKERS = [
    "log in to continue",
    "log in to view",
    "log in or sign up to continue",
]

EMPTY_RESULT_MARKERS = ["no results", "tidak ada hasil"]
