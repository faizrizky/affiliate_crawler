#!/usr/bin/env python
"""Report whether the persistent Threads profile is still a trusted session.

Run after any long idle period — a session can degrade silently: Threads keeps
serving a normal-looking search page while quietly returning nothing.

    python scripts/check_session.py            # uses CRAWLER_THREADS_BROWSER_PROFILE
    python scripts/check_session.py --copy     # while the crawler holds the profile
    python scripts/check_session.py --dump     # print marker candidates from the DOM
    python scripts/check_session.py --login    # headed browser for a MANUAL login (VNC)

--login opens the real profile in a visible browser through the exact same
network path the crawler uses (local SOCKS relay -> CRAWLER_THREADS_PROXY_SERVER)
with the same user-agent/locale/timezone, so the session you create by hand is
created from the same exit IP the crawler will later use it from. The script
never types credentials — you log in yourself, it only verifies the result.

Exit code 0 = session trusted, 1 = degraded/logged out, 2 = the check itself
could not run.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.settings import settings  # noqa: E402
from app.platforms.threads import socks_relay  # noqa: E402
from app.platforms.threads.client import BrowserSession, session_trust  # noqa: E402
from app.platforms.threads.selectors import (  # noqa: E402
    AUTHENTICATED_MARKERS,
    UNAUTHENTICATED_MARKERS,
)

HOME_URL = "https://www.threads.com/"

# Dump helper: every attribute we would consider stable enough to build a
# marker from, so selectors are read off the real DOM instead of guessed.
DUMP_JS = """
() => {
  const seen = [];
  for (const el of document.querySelectorAll('[data-testid], [aria-label], [role]')) {
    const rect = el.getBoundingClientRect();
    seen.push({
      tag: el.tagName.toLowerCase(),
      testid: el.getAttribute('data-testid'),
      label: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      href: el.getAttribute('href'),
      visible: rect.width > 0 && rect.height > 0,
      text: (el.innerText || '').trim().slice(0, 40),
    });
  }
  return {
    url: location.href,
    title: document.title,
    hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
    elements: seen.slice(0, 400),
  };
}
"""


def _start_relay() -> None:
    """Sama persis dengan lifespan app/main.py: relay lokal untuk proxy socks5."""
    if settings.threads_proxy_server:
        socks_relay.start(settings.threads_proxy_server)


def _context_options() -> dict[str, Any]:
    """Opsi context produksi — dibaca dari BrowserSession, bukan disalin.

    Menyalin opsi ke sini pernah jadi sumber drift (proxy/UA/locale beda tipis
    antara sesi manual dan sesi crawler). Panggil _start_relay() lebih dulu agar
    _proxy_options() di client memilih relay lokal, seperti di produksi.
    """
    return BrowserSession().context_options()


def _profile_lock_holder(profile: Path) -> str | None:
    """PID chromium lain yang masih memegang profil ini (kalau ada)."""
    needle = f"--user-data-dir={profile}"
    for proc in Path("/proc").iterdir():
        if not proc.name.isdigit():
            continue
        try:
            cmdline = (proc / "cmdline").read_bytes().replace(b"\x00", b" ").decode()
        except OSError:
            continue
        if needle in cmdline and "chrome" in cmdline:
            return proc.name
    return None


def _marker_report(page: Any, selectors: list[str]) -> list[tuple[str, int]]:
    found: list[tuple[str, int]] = []
    for selector in selectors:
        try:
            count = len(page.query_selector_all(selector))
        except Exception:
            count = 0
        found.append((selector, count))
    return found


def _print_markers(title: str, report: list[tuple[str, int]]) -> None:
    print(f"{title}:")
    if not report:
        print("  (none configured)")
        return
    for selector, count in report:
        print(f"  [{'x' if count else ' '}] {count:>3}  {selector}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default=settings.threads_browser_profile)
    parser.add_argument(
        "--copy",
        action="store_true",
        help="work on a throwaway copy of the profile (the running crawler locks the original)",
    )
    parser.add_argument("--url", default=HOME_URL)
    parser.add_argument("--dump", action="store_true", help="print DOM marker candidates")
    parser.add_argument("--headed", action="store_true", help="show the browser window")
    parser.add_argument(
        "--login",
        action="store_true",
        help=(
            "headed browser on the real profile for a MANUAL login; keeps the window "
            "open until you press Enter, then verifies the session"
        ),
    )
    parser.add_argument("--settle", type=float, default=8.0, help="seconds to let the page settle")
    args = parser.parse_args()

    headed = args.headed or args.login

    if not args.profile:
        print("no profile configured (CRAWLER_THREADS_BROWSER_PROFILE)", file=sys.stderr)
        return 2

    profile = Path(args.profile)
    if not profile.exists():
        print(f"profile not found: {profile}", file=sys.stderr)
        return 2

    if args.login and args.copy:
        print(
            "--login works on the real profile; --copy would throw the session away",
            file=sys.stderr,
        )
        return 2

    if headed and not os.environ.get("DISPLAY"):
        print(
            "no DISPLAY set — run inside the VNC session, e.g. DISPLAY=:99 "
            f"{sys.argv[0]} --login",
            file=sys.stderr,
        )
        return 2

    if not args.copy:
        holder = _profile_lock_holder(profile)
        if holder:
            print(
                f"profile is locked by chromium pid {holder} (the crawler is running). "
                "Stop the crawler service first, or use --copy for a read-only check.",
                file=sys.stderr,
            )
            return 2

    temp_dir: str | None = None
    if args.copy:
        temp_dir = tempfile.mkdtemp(prefix="threads-profile-check-")
        profile_copy = Path(temp_dir) / "profile"
        shutil.copytree(
            profile,
            profile_copy,
            symlinks=True,
            ignore=shutil.ignore_patterns("Singleton*", "*.lock"),
            ignore_dangling_symlinks=True,
        )
        profile = profile_copy

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed (pip install playwright)", file=sys.stderr)
        return 2

    try:
        _start_relay()
        options = _context_options()
        proxy_server = (options.get("proxy") or {}).get("server", "direct")
        print(f"profile:      {profile}")
        print(f"proxy:        {proxy_server}")
        if settings.threads_proxy_server:
            print(f"  upstream:   {settings.threads_proxy_server}")
        print(f"user-agent:   {options['user_agent']}")
        print(f"locale/tz:    {options['locale']} / {options['timezone_id']}")
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                str(profile),
                headless=not headed,
                args=["--disable-quic"],
                **options,
            )
            page = context.new_page()
            try:
                page.goto(
                    args.url,
                    wait_until="domcontentloaded",
                    timeout=settings.threads_browser_timeout * 1000,
                )
                time.sleep(args.settle)

                if args.login:
                    print(
                        "\n--- MANUAL LOGIN ---\n"
                        "Browser terbuka di VNC dengan proxy/profil/UA yang sama persis\n"
                        "dengan crawler produksi. Login sendiri di jendela itu (termasuk\n"
                        "2FA). Script ini TIDAK mengisi kredensial apa pun.\n"
                        "Kalau sudah selesai dan timeline Threads sudah tampil, kembali ke\n"
                        "terminal ini dan tekan Enter untuk verifikasi sesi."
                    )
                    try:
                        input("Tekan Enter setelah login selesai... ")
                    except EOFError:
                        print("(stdin tertutup — lanjut verifikasi)")
                    try:
                        page.goto(
                            HOME_URL,
                            wait_until="domcontentloaded",
                            timeout=settings.threads_browser_timeout * 1000,
                        )
                    except Exception as exc:
                        print(f"reload gagal: {exc}", file=sys.stderr)
                    time.sleep(args.settle)
                final_url = page.url or args.url
                auth_report = _marker_report(page, list(AUTHENTICATED_MARKERS))
                unauth_report = _marker_report(page, list(UNAUTHENTICATED_MARKERS))
                hard_wall = "/login" in urlparse(final_url).path or bool(
                    page.query_selector('input[type="password"]')
                )
                # Verdict memakai fungsi yang sama dengan crawler, supaya hasil
                # diagnostik tidak pernah beda dari perilaku produksi.
                trusted, markers_seen = session_trust(page)

                print(f"url:          {final_url}")
                print(f"login wall:   {'yes' if hard_wall else 'no'}")
                print(f"verdict:      session_trusted={trusted}")
                _print_markers("authenticated markers", auth_report)
                _print_markers("login (unauthenticated) markers", unauth_report)

                if args.dump:
                    dump = page.evaluate(DUMP_JS)
                    print("\n--- DOM candidates ---")
                    print(json.dumps(dump, indent=2, ensure_ascii=False))

                if trusted is True:
                    print(f"\nOK: session is trusted (markers: {', '.join(markers_seen)})")
                    return 0
                if hard_wall:
                    print("\nFAIL: logged out — Threads is showing the login wall")
                    return 1
                if trusted is False:
                    print(
                        "\nFAIL: normal-looking page but the session is not trusted "
                        f"(markers: {', '.join(markers_seen) or 'no positive marker'}) — "
                        "log this profile in again"
                    )
                    return 1
                print(
                    "\nUNKNOWN: no login affordance found, and AUTHENTICATED_MARKERS is "
                    "empty so a trusted session cannot be confirmed. Run with --dump on a "
                    "known-good logged-in profile and fill AUTHENTICATED_MARKERS in "
                    "app/platforms/threads/selectors.py."
                )
                return 1
            finally:
                page.close()
                context.close()
    finally:
        socks_relay.stop()
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
