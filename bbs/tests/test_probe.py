import time
from functools import partial

from ssharg import bbs
from ssharg.bbs import run_session
from ssharg.probe import DA1_REPLY, probe_sixel
from ssharg.screens import make_environment, render_screen
from ssharg.terminal import LineReader, Terminal

from .conftest import FakeChannel, PtyChannel


class SilentChannel:
    """A local channel (`poll`) on a terminal that never answers."""

    def __init__(self) -> None:
        self.sent = bytearray()

    def poll(self) -> bool:
        return False

    def recv(self, nbytes: int) -> bytes:
        raise AssertionError("recv() called with nothing ready")

    def sendall(self, data: bytes) -> None:
        self.sent.extend(data)


def test_reply_listing_attribute_4_means_sixel():
    chan = PtyChannel(reply=b"\x1b[?62;4;6c")
    assert probe_sixel(chan) is True
    assert bytes(chan.sent) == b"\x1b[c"


def test_reply_without_attribute_4_means_no_sixel():
    assert probe_sixel(PtyChannel(reply=b"\x1b[?61;1;6;7;21;22;23;24;28;32;42;52c")) is False
    assert probe_sixel(PtyChannel(reply=b"\x1b[?64;14;44c")) is False


def test_tmux_and_windows_terminal_replies():
    assert probe_sixel(PtyChannel(reply=b"\x1b[?1;2;4c")) is True
    assert probe_sixel(PtyChannel(reply=b"\x1b[?61;4;6;7;14;21;22;23;24;28;32;42;52c")) is True
    assert probe_sixel(PtyChannel(reply=b"\x1b[?4c")) is True


def test_reply_missing_its_escape_is_still_read():
    assert probe_sixel(PtyChannel(reply=b"[?61;4;6c")) is True


def test_reply_split_across_reads():
    chan = PtyChannel()
    chan.chunks = [b"\x1b[?62;", b"4;6c"]
    assert probe_sixel(chan) is True


def test_no_reply_times_out_quickly_as_no_sixel():
    chan = SilentChannel()
    typed = bytearray()
    start = time.monotonic()
    assert probe_sixel(chan, timeout=0.05, typed=typed) is None  # unanswered: no sixel
    assert time.monotonic() - start < 0.25
    assert bytes(chan.sent) == b"\x1b[c"
    assert typed == b""


def test_keys_typed_around_the_reply_are_kept():
    chan = PtyChannel([b"wr", b"en\x1b[?62;4c\rse"])
    typed = bytearray()
    assert probe_sixel(chan, typed=typed) is True
    assert typed == b"wren\rse"


def test_typed_keys_kept_when_terminal_never_answers():
    chan = PtyChannel([b"wren\r"])
    typed = bytearray()
    assert probe_sixel(chan, timeout=0.05, typed=typed) is None
    assert typed == b"wren\r"


def test_channel_without_readiness_helper_is_not_queried():
    chan = FakeChannel([b"\x1b[?62;4c"])
    assert probe_sixel(chan) is False
    assert chan.sent == b""
    assert chan.chunks == [b"\x1b[?62;4c"]


def test_session_records_sixel_and_screens_can_branch_on_it(world, store):
    chan = PtyChannel([b"wren\r", b"secret\r", b"G\r"], reply=b"\x1b[?62;4;c")
    code, ctx = run_session(world, store, chan, Terminal(chan, tty=True), source="test", pace=False)
    assert code == 0 and ctx.sixel is True and ctx.handle == "wren"
    assert chan.text.startswith("\x1b[c")
    env = make_environment({"menu": "{% if sixel %}IMAGE{% else %}TEXT{% endif %} {{ ctx.sixel }}\n"})
    assert render_screen(env, "menu", ctx.screen_vars()) == "IMAGE True\n"


def test_session_without_a_reply_has_no_sixel_and_keeps_typed_login(world, store):
    chan = PtyChannel([b"wren\r", b"secret\r", b"G\r"])
    code, ctx = run_session(world, store, chan, Terminal(chan, tty=True), source="test", pace=False)
    assert code == 0 and ctx.sixel is False and ctx.handle == "wren"
    env = make_environment({"menu": "{% if sixel %}IMAGE{% else %}TEXT{% endif %}\n"})
    assert render_screen(env, "menu", ctx.screen_vars()) == "TEXT"


class LateChannel(PtyChannel):
    """A terminal whose DA1 reply arrives after the probe has given up."""

    def __init__(self, chunks: list[bytes], reply: bytes) -> None:
        super().__init__(chunks)
        self.late = reply
        self.queried = False

    def recv_ready(self) -> bool:
        return not self.queried and bool(self.chunks)  # silent while the probe waits

    def sendall(self, data: bytes) -> None:
        if self.queried and self.late:  # the reply lands once the board starts drawing
            self.chunks.insert(0, self.late)
            self.late = b""
        self.queried = True
        super().sendall(data)


def test_late_reply_without_escape_does_not_reach_the_login(world, store, monkeypatch):
    monkeypatch.setattr(bbs, "probe_sixel", partial(probe_sixel, timeout=0.02))
    chan = LateChannel([b"wren\r", b"secret\r", b"G\r"], reply=b"[?61;4;6c")
    code, ctx = run_session(world, store, chan, Terminal(chan, tty=True), source="test", pace=False)
    assert code == 0 and ctx.sixel is False and ctx.handle == "wren"


def test_late_reply_is_dropped_once_and_is_not_a_keystroke():
    chan = PtyChannel([b"\x1b[?62;4c"])
    term = Terminal(chan, tty=True)
    reader = LineReader(chan, term)
    reader.late_reply = DA1_REPLY
    assert reader.key_waiting() is False  # an animation keeps running
    chan.chunks = [b"[?1;2c", b"\r"]  # a second match is not dropped
    assert reader.read_line("> ") == "[?1;2c"
