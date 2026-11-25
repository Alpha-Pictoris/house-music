"""BBS screen templates, rendered with Jinja2, and their timed playback.

World screens (`world/screens/NAME.txt|.ans`) are Jinja templates and may `{% include %}`
or `{% extends %}` one another. Any screen a world doesn't define falls back to the
built-in default of the same name.

Screens control their own pacing with three template functions:

    {{ pause(1.5) }}                      wait 1.5 s at this point (even mid-line)
    {% call rate(0.4) %}...{% endcall %}  wait 0.4 s after each line inside the block
    {% call typed(0.03) %}...{% endcall %} type the block 0.03 s per character

Each emits an invisible marker into the rendered text; `play_screen` acts on the markers
and `strip_timing` removes them when the screen is shown without pacing.
"""
from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from jinja2 import ChoiceLoader, DictLoader, Environment, StrictUndefined, TemplateNotFound

DEFAULT_SCREENS = {
    "login": "\n{{ bbs }}\n\n",
    "boot": "",
    "menu": (
        "\n"
        "  [K] Enter authorization key\n"
        "  [F] File area\n"
        "  [G] Goodbye\n"
        "\n"
    ),
    "dos": "",
    "key_accepted": "\nAUTHORIZATION KEY ACCEPTED.\n",
    "key_rejected": "\nINVALID AUTHORIZATION KEY.\n",
    "goodbye": "\nNO CARRIER\n",
}

# ASCII record separator: never appears in screen text, so it can delimit timing markers.
SEP = "\x1e"
_MARKER = re.compile(f"{SEP}([^{SEP}]*){SEP}")
# A line holding nothing but markers (and spaces) prints nothing, like a block tag.
_MARKER_ONLY_LINE = re.compile(f"^[ \\t]*((?:{SEP}[^{SEP}]*{SEP})+)[ \\t]*\\n", re.M)
# Typed output treats an ANSI escape sequence as a single character.
_TYPED_UNIT = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|.", re.S)


def _seconds(value: Any) -> float:
    seconds = float(value)
    if not seconds >= 0:  # also rejects NaN
        raise ValueError(f"delay must be a non-negative number of seconds, not {value!r}")
    return seconds


def _marker(command: str, seconds: float | None = None) -> str:
    return f"{SEP}{command}{'' if seconds is None else ':' + repr(seconds)}{SEP}"


def pause(seconds: Any) -> str:
    """Template function: wait `seconds` at this point in the screen."""
    return _marker("pause", _seconds(seconds))


def rate(seconds: Any, caller: Callable[[], str]) -> str:
    """Template call block: wait `seconds` after each line of the block."""
    return _marker("rate", _seconds(seconds)) + caller() + _marker("end")


def typed(seconds: Any, caller: Callable[[], str]) -> str:
    """Template call block: type the block out `seconds` per character."""
    return _marker("typed", _seconds(seconds)) + caller() + _marker("end")


def make_environment(screens: dict[str, str]) -> Environment:
    """A Jinja environment serving `screens`, then the defaults.

    Plain text output: no autoescaping, the trailing newline is kept, and block tags on
    their own line don't leave blank lines behind. Undefined variables raise
    `jinja2.UndefinedError` rather than rendering as empty text.
    """
    env = Environment(
        loader=ChoiceLoader([DictLoader(screens), DictLoader(DEFAULT_SCREENS)]),
        autoescape=False,
        undefined=StrictUndefined,
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals.update(pause=pause, rate=rate, typed=typed)
    return env


def render_screen(env: Environment, name: str, variables: dict[str, Any]) -> str:
    """Render screen `name` (timing markers included), or "" if no such screen exists."""
    try:
        template = env.get_template(name)
    except TemplateNotFound:
        return ""
    return _MARKER_ONLY_LINE.sub(r"\1", template.render(variables))


def strip_timing(text: str) -> str:
    """`text` with its timing markers removed, for showing a screen all at once."""
    return _MARKER.sub("", text)


def play_screen(text: str, write: Callable[[str], None], sleep: Callable[[float], None],
                line_delay: float = 0.0) -> None:
    """Write rendered `text`, sleeping as its timing markers direct.

    `line_delay` is the wait after each line outside any `rate` block.
    """
    speeds = [(line_delay, 0.0)]  # stack of (seconds per line, seconds per character)
    parts = _MARKER.split(text)
    for i, part in enumerate(parts):
        if i % 2:
            command, _, arg = part.partition(":")
            per_line, per_char = speeds[-1]
            if command == "pause":
                sleep(float(arg))
            elif command == "rate":
                speeds.append((float(arg), per_char))
            elif command == "typed":
                speeds.append((per_line, float(arg)))
            elif command == "end":
                if len(speeds) > 1:
                    speeds.pop()
            else:
                raise ValueError(f"unknown screen timing marker: {part!r}")
            continue
        per_line, per_char = speeds[-1]
        if per_char > 0:
            for unit in _TYPED_UNIT.findall(part):
                write(unit)
                sleep(per_char)
                if unit == "\n" and per_line > 0:
                    sleep(per_line)
        elif per_line > 0:
            for line in part.splitlines(keepends=True):
                write(line)
                if line.endswith("\n"):
                    sleep(per_line)
        elif part:
            write(part)
