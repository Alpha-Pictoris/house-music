from __future__ import annotations

from pathlib import Path

import pytest

from ssharg.bbs import run_session
from ssharg.context import Context
from ssharg.dos import run_command
from ssharg.probe import DA1_QUERY
from ssharg.scripts import load_world_scripts
from ssharg.state import StateStore
from ssharg.terminal import LineReader, Terminal
from ssharg.vfs import FsView, load_world

WORLD_DIR = Path(__file__).resolve().parent.parent / "world"


class FakeChannel:
    """Stands in for a paramiko Channel: scripted input chunks, captured output."""

    def __init__(self, chunks: list[bytes] | None = None, fail_after: int | None = None) -> None:
        self.chunks = list(chunks or [])
        self.sent = bytearray()
        self.stderr = bytearray()
        self.fail_after = fail_after
        self.writes = 0

    def recv(self, nbytes: int) -> bytes:
        return self.chunks.pop(0) if self.chunks else b""

    def sendall(self, data: bytes) -> None:
        self.writes += 1
        if self.fail_after is not None and self.writes > self.fail_after:
            raise OSError("Socket is closed")
        self.sent.extend(data)

    def sendall_stderr(self, data: bytes) -> None:
        self.stderr.extend(data)

    @property
    def text(self) -> str:
        return self.sent.decode("utf-8", "replace")


class PtyChannel(FakeChannel):
    """A FakeChannel with paramiko's `recv_ready`. Queued chunks are ready at once.

    `reply` is what the terminal answers to the DA1 query; it lands ahead of any typed input.
    """

    def __init__(self, chunks: list[bytes] | None = None, reply: bytes | None = None) -> None:
        super().__init__(chunks)
        self.reply = reply

    def recv_ready(self) -> bool:
        return bool(self.chunks)

    def sendall(self, data: bytes) -> None:
        super().sendall(data)
        if data == DA1_QUERY and self.reply is not None:
            self.chunks.insert(0, self.reply)


@pytest.fixture(scope="session")
def world():
    load_world_scripts(WORLD_DIR)
    return load_world(WORLD_DIR)


@pytest.fixture
def store(tmp_path):
    return StateStore(tmp_path / "state")


@pytest.fixture
def dial(world, store):
    """dial(*lines, tty=False, raw=None) -> (code, ctx, channel) for a whole BBS session.

    Each line is sent followed by a newline (CR on a tty). `raw` sends exact chunks instead.
    """
    def go(*lines: str, tty: bool = False, raw: list[bytes] | None = None, fail_after: int | None = None):
        end = "\r" if tty else "\n"
        chunks = raw if raw is not None else [(line + end).encode() for line in lines]
        chan = FakeChannel(chunks, fail_after)
        code, ctx = run_session(world, store, chan, Terminal(chan, tty=tty), source="test", pace=False)
        return code, ctx, chan
    return go


@pytest.fixture
def dos(world, store):
    """dos(line) -> output of one DOS command in a logged-in session shared per test."""
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term),
                  fs=FsView(world), username="alice", handle="Alice")
    ctx.fs.on_flag = ctx.grant_flag
    _, ctx.session_id = store.begin_session("alice", "test")

    def go(line: str) -> str:
        mark = len(chan.sent)
        go.left = run_command(ctx, line)
        return chan.sent[mark:].decode()
    go.ctx = ctx
    go.left = False
    return go
