from types import SimpleNamespace

import pytest
from jinja2 import UndefinedError

from ssharg.screens import DEFAULT_SCREENS, make_environment, render_screen


def test_world_screen_overrides_default_and_keeps_trailing_newline():
    env = make_environment({"goodbye": "Bye {{ user }}.\n"})
    assert render_screen(env, "goodbye", {"user": "ZERO"}) == "Bye ZERO.\n"


def test_missing_screen_falls_back_then_renders_empty():
    env = make_environment({})
    assert render_screen(env, "login", {"bbs": "KAT"}) == "\nKAT\n\n"
    assert render_screen(env, "key_rejected", {}) == DEFAULT_SCREENS["key_rejected"]
    assert render_screen(env, "nonexistent", {}) == ""


def test_blocks_and_includes_leave_no_stray_lines():
    env = make_environment({
        "header": "== {{ bbs }} ==\n",
        "menu": '{% include "header" %}\n{% if calls > 1 %}\nWelcome back.\n{% endif %}\n[G] Goodbye\n',
    })
    assert render_screen(env, "menu", {"bbs": "KAT", "calls": 2}) == "== KAT ==\nWelcome back.\n[G] Goodbye\n"
    assert render_screen(env, "menu", {"bbs": "KAT", "calls": 1}) == "== KAT ==\n[G] Goodbye\n"


def test_world_menu_box_stays_aligned(world):
    out = render_screen(world.templates, "menu", {"nomos_state": "Degraded", "ctx": SimpleNamespace(has_flag=lambda flag: False)})
    widths = {len(line) for line in out.splitlines() if line.strip().startswith(("|", "+"))}
    assert len(widths) == 1


def test_undefined_variable_raises():
    env = make_environment({"menu": "Status: {{ nomos_stat }}\n"})
    with pytest.raises(UndefinedError):
        render_screen(env, "menu", {"nomos_state": "Degraded"})


def _play(template: str, line_delay: float = 0.0, **variables):
    """Render then play `template`, returning the interleaved writes and sleeps."""
    from ssharg.screens import play_screen

    events: list = []
    text = render_screen(make_environment({"s": template}), "s", variables)
    play_screen(text, lambda t: events.append(t), lambda s: events.append(s), line_delay)
    return text, events


def _joined(events):
    """Merge adjacent writes so assertions don't depend on how text was chunked."""
    out: list = []
    for e in events:
        if isinstance(e, str) and out and isinstance(out[-1], str):
            out[-1] += e
        else:
            out.append(e)
    return out


def test_pause_mid_line_and_on_its_own_line():
    _, events = _play("Memory ....{{ pause(1.5) }} OK\n{{ pause(2) }}\nDone\n")
    assert _joined(events) == ["Memory ....", 1.5, " OK\n", 2.0, "Done\n"]


def test_rate_block_overrides_default_line_delay_then_restores_it():
    _, events = _play("a\n{% call rate(0.4) %}\nb\nc\n{% endcall %}\nd\n", line_delay=0.1)
    assert events == ["a\n", 0.1, "b\n", 0.4, "c\n", 0.4, "d\n", 0.1]


def test_typed_block_writes_per_character_and_keeps_ansi_whole():
    _, events = _play("{% call typed(0.03) %}\n\x1b[1mhi\n{% endcall %}\nok\n")
    assert events == ["\x1b[1m", 0.03, "h", 0.03, "i", 0.03, "\n", 0.03, "ok\n"]


def test_nested_blocks_and_typed_respects_line_rate():
    _, events = _play("{% call rate(1) %}\n{% call typed(0.5) %}\nx\n{% endcall %}\ny\n{% endcall %}\n")
    assert events == ["x", 0.5, "\n", 0.5, 1.0, "y\n", 1.0]


def test_strip_timing_leaves_plain_text():
    from ssharg.screens import strip_timing

    text, _ = _play("A{{ pause(1) }}B\n{% call rate(1) %}\nC\n{% endcall %}\n{{ pause(3) }}\nD\n")
    assert strip_timing(text) == "AB\nC\nD\n"


def test_bad_delay_is_rejected():
    for bad in ("-1", "'soon'", "'nan'"):
        with pytest.raises(ValueError):
            _play(f"{{{{ pause({bad}) }}}}")


def test_world_boot_screen_plays_with_no_leftover_markers(world):
    from ssharg.screens import SEP

    text = render_screen(world.templates, "boot", {"nomos_state": "Degraded"})
    _, events = _play(world.screens["boot"], line_delay=0.1, nomos_state="Degraded")
    written = "".join(e for e in events if isinstance(e, str))
    assert SEP not in written and written.strip()
    assert sum(e for e in events if not isinstance(e, str)) > 0
    assert text  # renders under strict mode
