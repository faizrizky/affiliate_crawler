from app.models.normalized_post import NormalizedPost
from app.pipelines.dedupe import dedupe
from app.pipelines.normalize import normalize
from app.pipelines.relevance import affiliate_score, relevance_score


def make(**kw) -> NormalizedPost:
    base = dict(external_id="1", author_username="u", content="", source_url="https://x/1")
    base.update(kw)
    return NormalizedPost(**base)


def test_relevance_phrase_and_words():
    post = make(content="the best serum review for dry skin", like_count=0)
    assert relevance_score("dry skin", post) == 90


def test_relevance_requires_keyword_match():
    # high likes no longer inflate relevance; the keyword must appear
    post = make(content="unrelated", like_count=1200)
    assert relevance_score("dry skin", post) == 0


def test_relevance_partial_word_match():
    # only one keyword word present -> partial score, not the full phrase
    post = make(content="dry face serum", like_count=0)
    assert relevance_score("dry skin", post) == 15


def test_relevance_no_match():
    post = make(content="unrelated", like_count=5)
    assert relevance_score("dry skin", post) == 0


def test_affiliate_all_signals():
    post = make(
        content="check https://shop.example.com/p/x?ref=aff full review",
        like_count=1200,
        reply_count=150,
    )
    assert affiliate_score(post) == 100


def test_affiliate_none():
    post = make(content="nice day", like_count=10, reply_count=2)
    assert affiliate_score(post) == 0


def test_dedupe():
    a = normalize({"external_id": "1", "author_username": "u", "content": "a", "source_url": "https://x/1"})
    b = normalize({"external_id": "1", "author_username": "u", "content": "b", "source_url": "https://x/1"})
    c = normalize({"external_id": "2", "author_username": "u", "content": "c", "source_url": "https://x/2"})
    assert [p.external_id for p in dedupe([a, b, c])] == ["1", "2"]
