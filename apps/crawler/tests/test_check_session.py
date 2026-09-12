"""Sesi login manual harus identik dengan sesi crawler produksi.

Kalau opsi context di script menyimpang dari BrowserSession (proxy, user-agent,
locale, timezone), sesi yang dibuat manual lewat VNC tidak lagi representatif —
justru itu yang mau dicegah.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

from app.config.settings import settings
from app.platforms.threads import socks_relay
from app.platforms.threads.client import BrowserSession

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_session.py"


@pytest.fixture(scope="module")
def check_session():
    spec = importlib.util.spec_from_file_location("check_session", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["check_session"] = module
    spec.loader.exec_module(module)
    yield module
    sys.modules.pop("check_session", None)


@pytest.fixture(autouse=True)
def _relay_stopped():
    yield
    socks_relay.stop()


def test_context_options_match_production(check_session, monkeypatch):
    monkeypatch.setattr(settings, "threads_proxy_server", None)
    assert check_session._context_options() == BrowserSession().context_options()


def test_login_session_uses_same_relay_as_crawler(check_session, monkeypatch):
    monkeypatch.setattr(settings, "threads_proxy_server", "socks5://10.0.0.1:1080")
    monkeypatch.setattr(settings, "threads_proxy_username", None)
    monkeypatch.setattr(settings, "threads_proxy_password", None)
    check_session._start_relay()
    options = check_session._context_options()
    assert socks_relay.port is not None
    # sama seperti produksi: chromium bicara ke relay lokal, relay ke upstream
    assert options["proxy"]["server"] == f"socks5://127.0.0.1:{socks_relay.port}"
    assert options == BrowserSession().context_options()


def test_headed_login_refuses_profile_copy(check_session, monkeypatch, tmp_path, capsys):
    profile = tmp_path / "prof"
    profile.mkdir()
    monkeypatch.setattr(sys, "argv", ["check_session.py", "--login", "--copy"])
    monkeypatch.setattr(settings, "threads_browser_profile", str(profile))
    assert check_session.main() == 2
    assert "--copy would throw the session away" in capsys.readouterr().err


def test_headed_requires_display(check_session, monkeypatch, tmp_path, capsys):
    profile = tmp_path / "prof"
    profile.mkdir()
    monkeypatch.delenv("DISPLAY", raising=False)
    monkeypatch.setattr(sys, "argv", ["check_session.py", "--login"])
    monkeypatch.setattr(settings, "threads_browser_profile", str(profile))
    assert check_session.main() == 2
    assert "no DISPLAY set" in capsys.readouterr().err


def test_locked_profile_is_refused(check_session, monkeypatch, tmp_path, capsys):
    profile = tmp_path / "prof"
    profile.mkdir()
    monkeypatch.setenv("DISPLAY", ":99")
    monkeypatch.setattr(check_session, "_profile_lock_holder", lambda _p: "4242")
    monkeypatch.setattr(sys, "argv", ["check_session.py", "--login"])
    monkeypatch.setattr(settings, "threads_browser_profile", str(profile))
    assert check_session.main() == 2
    assert "locked by chromium pid 4242" in capsys.readouterr().err
