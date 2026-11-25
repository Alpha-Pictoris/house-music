"""Paramiko SSH server: authentication, channel requests, and per-connection session handling."""
from __future__ import annotations

import json
import logging
import socket
import threading
import time
import traceback
import paramiko
from pydantic import BaseModel, ConfigDict

from ..bbs import run_session
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


class ArgServer(paramiko.ServerInterface):
    """Accepts any username; password, none and keyboard-interactive succeed; publickey fails.

    The SSH username is ignored: players log in to the BBS itself once connected.
    """

    def __init__(self, banner: str = "") -> None:
        self.banner = banner
        self.username = "guest"
        self.ready = threading.Event()
        self.command: str | None = None
        self.pty = False
        self.term_type = "xterm"
        self.width = 80
        self.terminal: Terminal | None = None

    def get_allowed_auths(self, username: str) -> str:
        return "password,keyboard-interactive"

    def _accept(self, username: str) -> int:
        self.username = username
        return paramiko.AUTH_SUCCESSFUL

    def check_auth_none(self, username: str) -> int:
        return self._accept(username)

    def check_auth_password(self, username: str, password: str) -> int:
        return self._accept(username)

    def check_auth_publickey(self, username: str, key: paramiko.PKey) -> int:
        return paramiko.AUTH_FAILED

    def check_auth_interactive(self, username: str, submethods: str) -> paramiko.InteractiveQuery:
        self.username = username
        return paramiko.InteractiveQuery()

    def check_auth_interactive_response(self, responses: list[str]) -> int:
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
        server = ArgServer(cfg.world.banner)
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
    print(f"ssharg listening on {bind}:{port} as {cfg.world.name}", flush=True)
    try:
        while True:
            sock, addr = listener.accept()
            threading.Thread(target=handle_connection, args=(sock, addr, cfg), daemon=True).start()
    except KeyboardInterrupt:
        pass
    finally:
        listener.close()
