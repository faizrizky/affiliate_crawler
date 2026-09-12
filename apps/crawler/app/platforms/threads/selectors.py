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

# --- Session trust markers -------------------------------------------------
#
# Dibaca dari DOM asli (scripts/check_session.py --dump) pada 2026-09-12,
# profil persisten runtime/threads-profile, locale id-ID.
#
# Temuan penting: ikon nav Beranda/Cari/Buat/Notifikasi/Profil TETAP dirender
# saat logged out, jadi tombol compose maupun entri profil di nav BUKAN penanda
# login — memakainya sebagai marker akan selalu "authenticated" dan menutupi
# justru state degraded yang mau dideteksi.
#
# Yang terbukti membedakan: tombol login di nav (aria-label "Login" pada locale
# id-ID) hanya ada saat sesi tidak dipercaya.
UNAUTHENTICATED_MARKERS = [
    '[aria-label="Login"]',
    '[aria-label="Log in"]',
    '[aria-label="Masuk"]',
]

# Penanda positif "sesi benar-benar dipercaya". Diverifikasi 2026-09-12 pada dua
# DOM asli dari profil persisten yang sama:
#   - logged out  -> 0 kemunculan (nav hanya punya "/" dan link "/@penulis" dari post)
#   - logged in   -> 2 kemunculan masing-masing (nav kiri + menu "Lebih banyak")
# Sengaja berbasis href, bukan aria-label, supaya tidak ikut berubah saat locale
# berubah (label id-ID "Insight"/"Tersimpan" akan berbeda di locale lain).
#
# Kandidat yang DITOLAK:
#   - div[role="button"]:text("Utas baru") -> ":text()" itu pseudo-class Playwright,
#     bukan CSS; document.querySelector melemparkan SyntaxError. Padanan yang sah
#     adalah '[aria-label="Utas baru"]', tapi itu locale-dependent.
#   - a[href^="/@"] (link profil) -> juga muncul saat logged out, karena setiap
#     post di feed menaut ke profil penulisnya.
AUTHENTICATED_MARKERS = [
    'a[href="/insights/"]',
    'a[href="/saved/"]',
]
