import pytest

from ssharg.screens import make_environment, play_screen, render_screen, render_text, strip_timing


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

def test_play_shows_the_final_frame_of_a_world_animation(dos):
    dos("cd users\\kade")
    out = dos("play scanner.ans")
    assert "NO RULE TABLE" in out          # text only the last frame carries
    assert out.count("[") == out.count("]")  # one bar, not every frame


def test_play_missing_file_and_directory(dos):
    assert dos("play nowhere.ans") == "File not found - NOWHERE.ANS\n"
    assert dos("play users").startswith("Access denied")
    assert dos("play") == "Required parameter missing\n"


def test_play_screen_reports_whether_a_key_stopped_the_animation():
    endless = render_screen(make_environment({"s": "{% call animate(0, loops=0) %}\nA\n{% endcall %}\n"}), "s", {})
    finite = render_screen(make_environment({"s": "{% call animate(0, loops=2) %}\nA\n{% endcall %}\n"}), "s", {})
    assert play_screen(endless, lambda t: None, lambda s: None, 0, lambda: True) is True
    assert play_screen(finite, lambda t: None, lambda s: None, 0, lambda: False) is False


def test_the_key_that_stops_an_animation_is_swallowed(world, store):
    """A stop key must not leak into the next prompt as a stray command."""
    from ssharg.context import Context
    from ssharg.terminal import LineReader, Terminal
    from ssharg.vfs import FsView

    class Chan:
        def recv(self, n): return b""
        def sendall(self, data): pass

    chan = Chan()
    ctx = Context(world=world, store=store, term=Terminal(chan, tty=True),
                  reader=LineReader(chan, Terminal(chan, tty=True)), fs=FsView(world), pace=True)
    ctx.reader.pending.extend("x\n")  # the key that "stopped" the animation, plus Enter
    text = render_text(world.templates, "{% call animate(0, loops=0) %}\nA\n{{ frame() }}\nB\n{% endcall %}\n",
                       ctx.screen_vars())
    ctx.show_rendered(text)
    assert list(ctx.reader.pending) == []
