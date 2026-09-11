from __future__ import annotations

import socket
import socketserver
import threading

from app.platforms.threads import socks_relay


class _FakeUpstream(socketserver.ThreadingTCPServer):
    """SOCKS5 upstream palsu: catat ATYP yang diterima, balas OK.

    Membedakan CONNECT berbasis domain (atyp=3) vs IP (atyp=1) untuk
    memastikan relay melakukan rewrite sebelum meneruskan ke upstream.
    """

    allow_reuse_address = True
    daemon_threads = True
    seen_atyp: list[int] = []

    class Handler(socketserver.BaseRequestHandler):
        def handle(self) -> None:
            conn = self.request
            try:
                # greeting: 05 nmethods methods...
                head = _recv(conn, 2)
                if not head or head[0] != 5:
                    return
                _recv(conn, head[1])
                conn.sendall(b"\x05\x00")  # pilih no-auth
                # request: 05 cmd rsv atyp addr port
                req_head = _recv(conn, 4)
                if not req_head:
                    return
                atyp = req_head[3]
                _FakeUpstream.seen_atyp.append(atyp)
                if atyp == 3:
                    length = _recv(conn, 1)
                    _recv(conn, length[0])
                elif atyp == 1:
                    _recv(conn, 4)
                else:
                    _recv(conn, 16)
                _recv(conn, 2)
                # balas success dengan bendera IP lokal
                conn.sendall(b"\x05\x00\x00\x01" + socket.inet_aton("127.0.0.1") + (0).to_bytes(2, "big"))
            except OSError:
                pass


def _recv(sock: socket, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            break
        buf += chunk
    return buf


def _socks_connect(relay_port: int, atyp: bytes, addr: bytes) -> bytes:
    """Kirim greeting + CONNECT ke relay, kembalikan header respons (4 byte)."""
    with socket.create_connection(("127.0.0.1", relay_port), timeout=10) as sock:
        sock.sendall(b"\x05\x01\x00")  # greeting no-auth
        assert _recv(sock, 2) == b"\x05\x00"
        # 05 cmd=1(connect) rsv=0 atyp addr port
        sock.sendall(b"\x05\x01\x00" + atyp + addr + (443).to_bytes(2, "big"))
        resp = _recv(sock, 4)
        # buang address+port pada respons biar koneksi tertutup bersih
        atyp_resp = resp[3]
        if atyp_resp == 1:
            _recv(sock, 6)
        elif atyp_resp == 3:
            _recv(sock, 1 + _recv(sock, 1)[0] + 2)
        else:
            _recv(sock, 18)
    return resp


def test_relay_rewrites_domain_to_ip() -> None:
    _FakeUpstream.seen_atyp.clear()
    upstream = _FakeUpstream(("127.0.0.1", 0), _FakeUpstream.Handler)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    try:
        relay_port = socks_relay.start(f"socks5://127.0.0.1:{upstream.server_address[1]}")
        # CONNECT berbasis domain (atyp=3): "localhost"
        domain = b"localhost"
        resp = _socks_connect(relay_port, b"\x03", bytes([len(domain)]) + domain)
        assert resp[1] == 0, f"harapannya success, dapat rep={resp[1]}"
        # relay wajib rewrite domain→IP sebelum ke upstream
        assert _FakeUpstream.seen_atyp == [1], _FakeUpstream.seen_atyp
    finally:
        socks_relay.stop()
        upstream.shutdown()
        upstream.server_close()


def test_relay_passes_ip_connect() -> None:
    _FakeUpstream.seen_atyp.clear()
    upstream = _FakeUpstream(("127.0.0.1", 0), _FakeUpstream.Handler)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    try:
        relay_port = socks_relay.start(f"socks5://127.0.0.1:{upstream.server_address[1]}")
        # CONNECT berbasis IP (atyp=1): harus diteruskan apa adanya
        resp = _socks_connect(relay_port, b"\x01", socket.inet_aton("1.2.3.4"))
        assert resp[1] == 0
        assert _FakeUpstream.seen_atyp == [1], _FakeUpstream.seen_atyp
    finally:
        socks_relay.stop()
        upstream.shutdown()
        upstream.server_close()
