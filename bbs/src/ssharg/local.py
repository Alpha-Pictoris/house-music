"""Run a session on the local terminal (stdin/stdout) instead of over SSH."""
from __future__ import annotations

import contextlib
import os
import select
import shutil
import signal
from typing import Iterator

from .bbs import run_session
from .state import StateStore
from .terminal import Terminal
from .vfs import World

try:
    import termios
    import tty as _tty
except ImportError:  # pragma: no cover - non-POSIX
    termios = None  # type: ignore[assignment]
    _tty = None  # type: ignore[assignment]


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        view = view[os.write(fd, view):]


class LocalChannel:
    """A `Channel` over raw file descriptors, defaulting to the process's stdio."""

    def __init__(self, stdin_fd: int = 0, stdout_fd: int = 1, stderr_fd: int = 2) -> None:
        self.stdin_fd = stdin_fd
        self.stdout_fd = stdout_fd
        self.stderr_fd = stderr_fd

    def recv(self, nbytes: int) -> bytes:
        return os.read(self.stdin_fd, nbytes)

    def poll(self) -> bool:
        """True when input is already waiting, so an animation can stop on a key."""
        return bool(select.select([self.stdin_fd], [], [], 0)[0])

    def sendall(self, data: bytes) -> None:
        _write_all(self.stdout_fd, data)

    def sendall_stderr(self, data: bytes) -> None:
        _write_all(self.stderr_fd, data)


@contextlib.contextmanager
def raw_mode(fd: int) -> Iterator[None]:
    """Put the tty on `fd` into raw mode, like an SSH client does, and restore it afterwards."""
    if termios is None:
        yield
        return
    saved = termios.tcgetattr(fd)
    try:
        _tty.setraw(fd)
        yield
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, saved)


@contextlib.contextmanager
def track_width(term: Terminal) -> Iterator[None]:
    """Keep `term.width` in step with the local terminal while the session runs."""
    if not hasattr(signal, "SIGWINCH"):
        yield
        return

    def on_resize(signum, frame) -> None:
        term.width = max(20, shutil.get_terminal_size().columns)

    previous = signal.signal(signal.SIGWINCH, on_resize)
    try:
        yield
    finally:
        signal.signal(signal.SIGWINCH, previous)


def run_local(world: World, store: StateStore, channel: LocalChannel | None = None,
              pace: bool = True) -> int:
    """Run a BBS session on this terminal. Piped (non-tty) input works line by line."""
    channel = channel or LocalChannel()
    interactive_tty = (termios is not None
                       and os.isatty(channel.stdin_fd) and os.isatty(channel.stdout_fd))
    term = Terminal(channel, tty=interactive_tty, width=shutil.get_terminal_size().columns)
    if not interactive_tty:
        return run_session(world, store, channel, term, source="local", pace=pace)[0]
    with raw_mode(channel.stdin_fd), track_width(term):
        if world.banner:
            term.write(world.banner)
        code, _ = run_session(world, store, channel, term, source="local", pace=pace)
    return code
