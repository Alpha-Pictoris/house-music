"""Paramiko SSH server: authentication, channel requests, and per-connection session handling."""
from __future__ import annotations

import base64
import json
import logging
import socket
import threading
import time
import traceback
import paramiko
from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives.serialization import SSHCertificate, SSHPublicKeyTypes, load_ssh_public_identity
from pydantic import BaseModel, ConfigDict

from ..bbs import run_session
from ..certs import CertificateRejected, verify
from ..state import StateStore
from ..terminal import Terminal
from ..vfs import World

SERVER_VERSION = "SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5"
CHANNEL_WAIT = 30.0
CLOSE_GRACE = 3.0


class ServerConfig(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    world: World
    store: StateStore
    host_key: paramiko.PKey
    user_ca: SSHPublicKeyTypes | None = None


class ArgServer(paramiko.ServerInterface):
    """Admits every client with SSH's `none` method, or, given a `user_ca`, only clients holding
    a certificate that `certs.verify` accepts for their username.

    Every other auth method fails through paramiko's defaults. Players still log in to the BBS
    itself once connected.
    """

    def __init__(self, user_ca: SSHPublicKeyTypes | None = None, banner: str = "") -> None:
        self.user_ca = user_ca
        self.banner = banner
        self.username = "guest"
        self.ready = threading.Event()
        self.command: str | None = None
        self.pty = False
        self.term_type = "xterm"
        self.width = 80
        self.terminal: Terminal | None = None

    def get_allowed_auths(self, username: str) -> str:
        return "none" if self.user_ca is None else "publickey"

    def check_auth_none(self, username: str) -> int:
        if self.user_ca is not None:
            return paramiko.AUTH_FAILED
        self.username = username
        return paramiko.AUTH_SUCCESSFUL

    def check_auth_publickey(self, username: str, key: paramiko.PKey) -> int:
        if self.user_ca is None:
            return paramiko.AUTH_FAILED
        cert = _certificate(key)
        if cert is None:
            return paramiko.AUTH_FAILED
        try:
            userdata = verify(cert, self.user_ca, username)
        except CertificateRejected as e:
            print(f"cert rejected user={json.dumps(username)}: {e}", flush=True)
            return paramiko.AUTH_FAILED
        print(f"cert extension userdata@house-music: {json.dumps(userdata.decode('utf-8', 'replace'))}", flush=True)
        self.username = username
        return paramiko.AUTH_SUCCESSFUL

    def check_channel_request(self, kind: str, chanid: int) -> int:
        if kind == "session":
            return paramiko.OPEN_SUCCEEDED
        return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

    def check_channel_pty_request(self, channel, term, width, height, pixelwidth, pixelheight, modes) -> bool:
        self.pty = True
        self.term_type = term.decode("ascii", "replace") if isinstance(term, bytes) else str(term)
        self.width = width or 80
        return True

    def check_channel_window_change_request(self, channel, width, height, pixelwidth, pixelheight) -> bool:
        self.width = width or self.width
        if self.terminal:
            self.terminal.width = max(20, self.width)
        return True

    def check_channel_shell_request(self, channel) -> bool:
        self.ready.set()
        return True

    def check_channel_exec_request(self, channel, command: bytes) -> bool:
        self.command = command.decode("utf-8", "replace")
        self.ready.set()
        return True

    def get_banner(self) -> tuple[str | None, str | None]:
        if not self.banner:
            return None, None
        return self.banner.replace("\r\n", "\n").replace("\n", "\r\n"), "en-US"


NO_EXEC = "This system requires an interactive terminal.\n"


def _certificate(key: paramiko.PKey) -> SSHCertificate | None:
    blob = getattr(key, "public_blob", None)
    if blob is None:
        return None
    try:
        identity = load_ssh_public_identity(blob.key_type.encode() + b" " + base64.b64encode(blob.key_blob))
    except (ValueError, UnsupportedAlgorithm):
        return None
    return identity if isinstance(identity, SSHCertificate) else None


def _session_log(username: str, addr: tuple, history: list[str]) -> None:
    source = f"{addr[0]}:{addr[1]}" if len(addr) >= 2 else str(addr)
    print(f"session user={username} src={source} history={json.dumps(history)}", flush=True)


def _finish(transport: paramiko.Transport, channel: paramiko.Channel, code: int) -> None:
    """Send the exit status, close the channel, and give the client time to hang up first."""
    try:
        channel.send_exit_status(code)
        channel.shutdown_write()
        channel.close()
        deadline = time.monotonic() + CLOSE_GRACE
        while transport.is_active() and time.monotonic() < deadline:
            time.sleep(0.05)
    except Exception:
        pass


def handle_connection(sock: socket.socket, addr: tuple, cfg: ServerConfig) -> None:
    """Serve one TCP connection to completion. Never raises."""
    transport = channel = None
    try:
        transport = paramiko.Transport(sock)
        transport.local_version = SERVER_VERSION
        transport.add_server_key(cfg.host_key)
        server = ArgServer(cfg.user_ca, cfg.world.banner)
        transport.start_server(server=server)
        channel = transport.accept(CHANNEL_WAIT)
        if channel is None or not server.ready.wait(CHANNEL_WAIT):
            return
        if server.command is not None:
            channel.sendall_stderr(NO_EXEC.encode())
            _finish(transport, channel, 1)
            return
        term = Terminal(channel, tty=server.pty, width=server.width)
        server.terminal = term
        code, ctx = run_session(cfg.world, cfg.store, channel, term, source=f"{addr[0]}:{addr[1]}")
        if ctx.session_id:
            _session_log(ctx.username, addr, ctx.history)
        _finish(transport, channel, code)
    except (paramiko.SSHException, EOFError, OSError):
        pass
    except Exception:
        traceback.print_exc()
    finally:
        for closable in (channel, transport):
            try:
                if closable is not None:
                    closable.close()
            except Exception:
                pass
        try:
            sock.close()
        except OSError:
            pass


def quiet_paramiko() -> None:
    log = logging.getLogger("paramiko")
    log.addHandler(logging.NullHandler())
    log.propagate = False


def serve(cfg: ServerConfig, bind: str, port: int) -> None:
    """Accept connections forever, one thread per client."""
    quiet_paramiko()
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((bind, port))
    listener.listen(64)
    auth = "anyone can connect" if cfg.user_ca is None else "certificates required"
    print(f"ssharg listening on {bind}:{port} as {cfg.world.name} ({auth})", flush=True)
    try:
        while True:
            sock, addr = listener.accept()
            threading.Thread(target=handle_connection, args=(sock, addr, cfg), daemon=True).start()
    except KeyboardInterrupt:
        pass
    finally:
        listener.close()
