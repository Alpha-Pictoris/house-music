import pytest

from ssharg.context import Context
from ssharg.dos import run_command
from ssharg.screens import (MIN_ENDLESS_DELAY, make_environment, play_screen, render_screen,
                            render_text, strip_timing)
from ssharg.terminal import LineReader, Terminal
from ssharg.vfs import FsView, load_world

from .conftest import FakeChannel, PtyChannel


def _play(template: str, line_delay: float = 0.0, interrupt=None, **variables):
    """Render then play `template`, returning the interleaved writes and sleeps."""
    events: list = []
    text = render_screen(make_environment({"s": template}), "s", variables)
    play_screen(text, lambda t: events.append(t), lambda s: events.append(s), line_delay, interrupt)
    return text, events


def _joined(events):
    out: list = []
    for e in events:
        if isinstance(e, str) and out and isinstance(out[-1], str):
            out[-1] += e
        else:
            out.append(e)
    return out


REDRAW = "\x1b[0m\r\x1b[1A\x1b[J"  # the redraw of a one-line frame


def test_animation_writes_each_frame_once_and_waits_between():
    _, events = _play("{% call animate(0.5) %}\nA\n{{ frame() }}\nB\n{% endcall %}\n")
    assert events == ["A\n", 0.5, REDRAW, "B\n"]  # no wait after the final frame


def test_animation_loops_redraw_the_whole_set():
    _, events = _play("{% call animate(1, loops=2) %}\nA\n{{ frame() }}\nB\n{% endcall %}\n")
    assert events == ["A\n", 1.0, REDRAW, "B\n", 1.0, REDRAW, "A\n", 1.0, REDRAW, "B\n"]


def test_frame_delay_overrides_the_block_delay():
    _, events = _play("{% call animate(1) %}\nA\n{{ frame(0.25) }}\nB\n{% endcall %}\n")
    assert events == ["A\n", 0.25, REDRAW, "B\n"]


def test_multiline_frames_move_the_cursor_up_by_their_line_count():
    _, events = _play("{% call animate(1) %}\nA\nB\n{{ frame() }}\nC\nD\n{% endcall %}\n")
    assert events == ["A\nB\n", 1.0, "\x1b[0m\r\x1b[2A\x1b[J", "C\nD\n"]


def test_animation_stops_when_a_key_is_waiting():
    keys = iter([False, True])
    _, events = _play("{% call animate(1, loops=0) %}\nA\n{{ frame() }}\nB\n{% endcall %}\n",
                      interrupt=lambda: next(keys, True))
    assert events == ["A\n", 1.0, REDRAW, "B\n"]  # the wait, then the key ended it


def test_surrounding_text_is_kept_and_markers_leave_no_trace():
    text, events = _play("BEFORE\n{% call animate(0.1) %}\nA\n{{ frame() }}\nB\n{% endcall %}\nAFTER\n")
    assert _joined(events) == ["BEFORE\nA\n", 0.1, REDRAW + "B\nAFTER\n"]


def test_strip_timing_keeps_only_the_last_frame():
    text, _ = _play("BEFORE\n{% call animate(0.1, loops=0) %}\nA\n{{ frame() }}\nB\n{% endcall %}\nAFTER\n",
                    interrupt=lambda: True)  # loops=0 here only tests the render, never played
    assert strip_timing(text) == "BEFORE\nB\nAFTER\n"


def test_pause_and_rate_inside_a_frame_are_dropped_not_executed():
    template = ("{% call animate(0.1) %}\nA{{ pause(9) }}X\n{% call rate(9) %}\nLINE\n{% endcall %}\n"
                "{{ frame() }}\nB\n{% endcall %}\n")
    _, events = _play(template)
    assert events == ["AX\nLINE\n", 0.1, "\x1b[0m\r\x1b[2A\x1b[J", "B\n"]


def test_nested_animations_are_rejected():
    with pytest.raises(ValueError):
        _play("{% call animate(1) %}\nA\n{% call animate(1) %}\nB\n{% endcall %}\n{% endcall %}\n")


def test_bad_arguments_are_rejected():
    for template in ("{% call animate(-1) %}\nA\n{% endcall %}",
                     "{% call animate(1, loops=-2) %}\nA\n{% endcall %}",
                     "{% call animate(1, loops=1.5) %}\nA\n{% endcall %}"):
        with pytest.raises((ValueError, TypeError)):
            _play(template)


def test_frame_marker_outside_an_animation_is_harmless():
    _, events = _play("A\n{{ frame(0.5) }}\nB\n")
    assert _joined(events) == ["A\nB\n"]


# --- PLAY through the DOS prompt (paced off: shows the final frame) -----------------

SCAN = ("Press any key to stop the scan.\n\n{% call animate(0.15, loops=0) %}\n"
        "  [    ] listening\n{{ frame() }}\n  [====] NO RULE TABLE\n{% endcall %}\n")


@pytest.fixture
def play(tmp_path, store):
    """play(line) -> output, in a world holding C:\\SCANS\\SCAN.ANS."""
    (tmp_path / "root" / "SCANS").mkdir(parents=True)
    (tmp_path / "root" / "SCANS" / "SCAN.ANS").write_bytes(SCAN.encode("cp437"))
    world = load_world(tmp_path)
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))

    def go(line: str) -> str:
        mark = len(chan.sent)
        run_command(ctx, line)
        return chan.sent[mark:].decode()
    return go


def test_play_shows_the_final_frame_of_an_animation(play):
    out = play("play scans\\scan.ans")
    assert "NO RULE TABLE" in out and "listening" not in out


def test_play_says_how_to_stop_before_the_animation_starts(play):
    out = play("play scans\\scan.ans")
    assert out.index("Press any key to stop the scan.") < out.index("[")


def test_play_missing_file_and_directory(play):
    assert play("play nowhere.ans") == "File not found - NOWHERE.ANS\n"
    assert play("play scans").startswith("Access denied")
    assert play("play") == "Required parameter missing\n"


def test_play_screen_reports_whether_a_key_stopped_the_animation():
    endless = render_screen(make_environment({"s": "{% call animate(0, loops=0) %}\nA\n{% endcall %}\n"}), "s", {})
    finite = render_screen(make_environment({"s": "{% call animate(0, loops=2) %}\nA\n{% endcall %}\n"}), "s", {})
    assert play_screen(endless, lambda t: None, lambda s: None, 0, lambda: True) is True
    assert play_screen(finite, lambda t: None, lambda s: None, 0, lambda: False) is False


def _live_ctx(world, store, chan):
    term = Terminal(chan, tty=True)
    return Context(world=world, store=store, term=term, reader=LineReader(chan, term),
                   fs=FsView(world), pace=True)


ENDLESS = "{% call animate(0, loops=0) %}\nA\n{{ frame() }}\nB\n{% endcall %}\n"


def test_the_key_that_stops_an_animation_is_swallowed(world, store):
    """A stop key must not leak into the next prompt as a stray command."""
    chan = PtyChannel([b"x\r"])  # the key is still on the channel, as over SSH
    ctx = _live_ctx(world, store, chan)
    ctx.show_rendered(render_text(world.templates, ENDLESS, ctx.screen_vars()))
    chan.chunks.append(b"DIR\r")
    assert ctx.reader.read_line("> ") == "DIR"


def test_a_hang_up_stops_an_endless_animation(world, store):
    class HungUp(PtyChannel):
        def recv_ready(self): return True  # paramiko reports EOF as readable

    ctx = _live_ctx(world, store, HungUp())
    ctx.show_rendered(render_text(world.templates, ENDLESS, ctx.screen_vars()))
    assert ctx.reader.read_line("> ") is None


def test_frame_marker_before_endcall_does_not_add_an_empty_frame():
    template = "{% call animate(1, loops=2) %}\nA\n{{ frame() }}\nB\n{{ frame(0.25) }}\n{% endcall %}\nAFTER\n"
    text, events = _play(template)
    assert events == ["A\n", 1.0, REDRAW, "B\n", 0.25, REDRAW, "A\n", 1.0, REDRAW, "B\n", "AFTER\n"]
    assert strip_timing(text) == "B\nAFTER\n"


def test_endless_animation_waits_a_minimum_between_frames():
    keys = iter([False, False, True])
    _, events = _play(ENDLESS, interrupt=lambda: next(keys))
    assert [e for e in events if isinstance(e, float)] == [MIN_ENDLESS_DELAY, MIN_ENDLESS_DELAY]


def test_play_shows_plain_text_with_braces_as_typed(tmp_path, store, capsys):
    (tmp_path / "root").mkdir()
    (tmp_path / "root" / "PRICES.TXT").write_text("lamp: {{ cost }}\n{% shelf %}\n")
    world = load_world(tmp_path)
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))
    run_command(ctx, "play prices.txt")
    assert chan.text == "lamp: {{ cost }}\n{% shelf %}\n"
    assert "PRICES.TXT" in capsys.readouterr().err
