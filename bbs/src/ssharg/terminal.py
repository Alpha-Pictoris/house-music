"""Transport-agnostic terminal I/O: a byte `Channel`, a `Terminal` writer, and a `LineReader`."""
from __future__ import annotations

import codecs
import re
from collections import deque
from typing import Callable, Protocol

MAX_LINE = 4096
BLUE, GREEN, CYAN, RED, YELLOW, BOLD = "1;34", "1;32", "1;36", "1;31", "1;33", "1"
CLEAR_SCREEN = "\x1b[2J\x1b[H"


class SessionClosed(Exception):
    """The client went away; unwind the session quietly."""


class Channel(Protocol):
    def recv(self, nbytes: int, /) -> bytes: ...
    def sendall(self, data: bytes, /) -> None: ...


def ready_check(channel: Channel) -> Callable[[], bool] | None:
    """The channel's non-blocking "input waiting?" helper: `poll` (local) or `recv_ready` (paramiko)."""
    for name in ("poll", "recv_ready"):
        check = getattr(channel, name, None)
        if callable(check):
            return check
    return None


class Terminal:
    """Writes text to a channel, translating newlines for ttys and absorbing disconnects."""

    def __init__(self, channel: Channel, tty: bool, width: int = 80) -> None:
        self.channel = channel
        self.tty = tty
        self.colour = tty
        self.width = max(20, width)
        self.closed = False

    def _send(self, text: str, stderr: bool = False) -> None:
        if self.closed:
            raise SessionClosed()
        if self.tty:
            text = text.replace("\r\n", "\n").replace("\n", "\r\n")
        data = text.encode("utf-8", "replace")
        sender = getattr(self.channel, "sendall_stderr", None) if stderr and not self.tty else None
        try:
            (sender or self.channel.sendall)(data)
        except Exception as exc:
            self.closed = True
            raise SessionClosed() from exc

    def write(self, text: str) -> None:
        self._send(text)

    def line(self, text: str = "") -> None:
        self._send(text + "\n")

    def err(self, text: str) -> None:
        self._send(text + "\n", stderr=True)

    def clear(self) -> None:
        if self.tty:
            self._send(CLEAR_SCREEN)

    def paint(self, text: str, code: str) -> str:
        return f"\x1b[{code}m{text}\x1b[0m" if self.colour else text


class LineReader:
    """Reads one edited line at a time from a raw channel: typing, Backspace, Ctrl-C, Ctrl-D."""

    def __init__(self, channel: Channel, term: Terminal) -> None:
        self.channel = channel
        self.term = term
        self.pending: deque[str] = deque()
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.skip_lf = False
        self.eof = False
        self.ready = ready_check(channel)
        # A terminal reply that may still arrive, such as an unanswered capability probe.
        # The first match is dropped from input, so it never reads as typing.
        self.late_reply: re.Pattern[bytes] | None = None

    def _receive(self) -> bool:
        """Read one chunk from the channel into `pending`. False at end of input."""
        try:
            data = self.channel.recv(1024)
        except Exception:
            data = b""
        if not data:
            self.eof = True
            return False
        if self.late_reply is not None and (found := self.late_reply.search(data)):
            data = data[:found.start()] + data[found.end():]
            self.late_reply = None
        self.pending.extend(self.decoder.decode(data))
        return True

    def _channel_ready(self) -> bool:
        if self.eof or self.ready is None:
            return False
        try:
            return bool(self.ready())
        except Exception:
            return False

    def key_waiting(self) -> bool:
        """True when the player has typed something not yet read, or has hung up.

        Reads only what the channel already holds, so it never blocks.
        """
        while not self.pending and self._channel_ready():
            if not self._receive():
                break
        return bool(self.pending) or self.eof

    def discard_waiting(self) -> None:
        """Drop everything typed but not yet read, such as the key that stopped an animation."""
        while self._channel_ready() and self._receive():
            pass
        self.pending.clear()

    def _next(self) -> str | None:
        while not self.pending:
            if self.eof or not self._receive():
                return None
        return self.pending.popleft()

    def _skip_escape(self) -> None:
        ch = self._next()
        if ch in ("[", "O"):
            while (ch := self._next()) is not None and not ("@" <= ch <= "~"):
                pass

    def _echo(self, text: str) -> None:
        if self.term.tty:
            self.term.write(text)

    def read_line(self, prompt: str, mask: str | None = None) -> str | None:
        """Return the next line, or None at end of input. With `mask`, echo it instead of the text."""
        self.term.write(prompt)
        line = ""
        while True:
            ch = self._next()
            if ch is None:
                return line or None
            if ch == "\n" and self.skip_lf:
                self.skip_lf = False
                continue
            self.skip_lf = ch == "\r"
            if ch in "\r\n":
                self._echo("\r\n")
                return line
            if ch == "\x03":
                self._echo("^C\r\n")
                self.term.write(prompt)
                line = ""
            elif ch == "\x04":
                if not line:
                    return None
            elif ch in "\x7f\x08":
                if line:
                    line = line[:-1]
                    self._echo("\b \b")
            elif ch == "\x1b":
                self._skip_escape()
            elif ch >= " " and len(line) < MAX_LINE:
                line += ch
                self._echo(mask or ch)
