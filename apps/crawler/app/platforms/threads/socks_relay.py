from __future__ import annotations

import socket
import socketserver
import threading
import time
from ipaddress import ip_address
from urllib.parse import urlparse

from structlog import get_logger

log = get_logger()

port: int | None = None
_lock = threading.Lock()
_server: socketserver.ThreadingTCPServer | None = None


def _recv_exact(sock: socket, n: int) -> bytes | None:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def _read_address_bytes(atyp: int, sock: socket) -> bytes | None:
    if atyp == 3:
        length = _recv_exact(sock, 1)
        if length is None:
            return None
        domain = _recv_exact(sock, length[0])
        if domain is None:
            return None
        return length + domain
    if atyp in (1, 4):
        return _recv_exact(sock, 4 if atyp == 1 else 16)
    return None


def _read_request(sock: socket) -> bytes | None:
    # header sudah berisi ATYP di request[3]; jangan baca ATYP dua kali
    header = _recv_exact(sock, 4)
    if header is None:
        return None
    addr = _read_address_bytes(header[3], sock)
    if addr is None:
        return None
    port = _recv_exact(sock, 2)
    if port is None:
        return None
    return header + addr + port


def _rewrite_domain_to_ip(request: bytes) -> bytes | None:
    """SOCKS5 request dengan ATYP domain (3) → ATYP IPv4 (1) via DNS lokal."""
    atyp = request[3]
    if atyp != 3:
        return request
    length = request[4]
    domain = request[5 : 5 + length].decode("ascii", "replace")
    try:
        info = socket.getaddrinfo(domain, None, socket.AF_INET, socket.SOCK_STREAM)
    except OSError:
        log.warning("socks_relay_resolve_failed", domain=domain)
        return None
    ip = ip_address(info[0][4][0])
    return request[:3] + b"\x01" + ip.packed + request[5 + length :]


def _pump(src: socket, dst: socket) -> None:
    try:
        while True:
            chunk = src.recv(65536)
            if not chunk:
                break
            dst.sendall(chunk)
    except OSError:
        pass
    try:
        dst.shutdown(socket.SHUT_WR)
    except OSError:
        pass


def _connect_upstream(
    host: str, port: int, greeting: bytes, request: bytes
) -> tuple[socket.socket | None, bytes | None]:
    # proxy upstream tidak stabil (koneksi baru kadang di-drop, kadang balas
    # REP != 0); retry seluruh handshake CONNECT, bukan cuma TCP connect.
    # 3x8s + backoff < timeout goto browser (30s)
    response: bytes | None = None
    for attempt in range(3):
        up: socket.socket | None = None
        try:
            up = socket.create_connection((host, port), timeout=8)
            up.sendall(greeting)
            auth = _recv_exact(up, 2)
            if auth is not None and auth == b"\x05\x00":
                up.sendall(request)
                response = _recv_exact(up, 4)
                if response is not None and response[1] == 0:
                    return up, response
        except OSError:
            pass
        if up is not None:
            try:
                up.close()
            except OSError:
                pass
        if attempt < 2:
            time.sleep(0.3)
    return None, response


class _Handler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        client = self.request
        host: str = self.server.upstream_host
        up_port: int = self.server.upstream_port
        upstream: socket.socket | None = None
        try:
            head = _recv_exact(client, 2)
            if head is None or head[0] != 5:
                return
            methods = _recv_exact(client, head[1])
            if methods is None:
                return
            client.sendall(b"\x05\x00")
            request = _read_request(client)
            if request is None:
                return
            if request[1] == 1 and request[3] == 3:
                rewritten = _rewrite_domain_to_ip(request)
                if rewritten is None:
                    client.sendall(b"\x05\x04\x00\x01" + b"\x00" * 6)
                    return
                request = rewritten
            # ponytail: asumsi upstream tanpa auth; jika proxy mulai mewajibkan
            # username/password, tambah sub-negosiasi di _connect_upstream
            upstream, response = _connect_upstream(host, up_port, head + methods, request)
            if upstream is None:
                log.warning(
                    "socks_relay_upstream_failed",
                    rep=response[1] if response is not None else None,
                )
                client.sendall(response or b"\x05\x01\x00\x01" + b"\x00" * 6)
                return
            assert response is not None
            # header respons sudah berisi ATYP di response[3]; baca addr+port
            addr = _read_address_bytes(response[3], upstream)
            if addr is None:
                return
            bound_port = _recv_exact(upstream, 2)
            if bound_port is None:
                return
            client.sendall(response + addr + bound_port)
            pumps = [
                threading.Thread(target=_pump, args=(client, upstream), daemon=True),
                threading.Thread(target=_pump, args=(upstream, client), daemon=True),
            ]
            for t in pumps:
                t.start()
            for t in pumps:
                t.join()
        except OSError as exc:
            log.debug("socks_relay_closed", error=str(exc))
        finally:
            for sock in (client, upstream):
                try:
                    sock.close()
                except OSError:
                    pass


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    upstream_host: str = ""
    upstream_port: int = 0


def start(upstream: str) -> int:
    global port, _server
    with _lock:
        if _server is not None:
            return port
        parsed = urlparse(upstream)
        server = _Server(("127.0.0.1", 0), _Handler)
        server.upstream_host = parsed.hostname or "127.0.0.1"
        server.upstream_port = parsed.port or 1080
        threading.Thread(target=server.serve_forever, daemon=True).start()
        _server = server
        port = server.server_address[1]
        log.info("socks_relay_started", port=port, upstream=upstream)
        return port


def stop() -> None:
    global port, _server
    with _lock:
        if _server is None:
            return
        _server.shutdown()
        _server.server_close()
        _server = None
        port = None
        log.info("socks_relay_stopped")
