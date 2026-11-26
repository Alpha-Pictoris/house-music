"""BBS screen templates, rendered with Jinja2, and their timed playback.

World screens (`world/screens/NAME.txt|.ans`) are Jinja templates and may `{% include %}`
or `{% extends %}` one another. Any screen a world doesn't define falls back to the
built-in default of the same name.

Screens pace themselves with template functions:

    {{ pause(1.5) }}                          wait 1.5 s at this point (even mid-line)
    {% call rate(0.4) %}...{% endcall %}      wait 0.4 s after each line inside the block
    {% call typed(0.03) %}...{% endcall %}    type the block 0.03 s per character
    {% call animate(0.2, loops=0) %}...{% endcall %}  redraw the block as frames

Animations split into frames with `{{ frame() }}`, on a line of its own. Each frame
replaces the one before it in place. `loops` repeats the whole set; 0 loops until the
player presses a key, which then stops the animation.

Each construct emits an invisible marker into the rendered text; `play_screen` acts on
the markers and `strip_timing` removes them when the screen is shown without pacing.
An unpaced animation shows only its last frame.
"""
from __future__ import annotations

import operator
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


def frame(seconds: Any = None) -> str:
    """Template function: end the current animation frame.

    On a line of its own inside an `animate` block. Optional `seconds` overrides
    the block delay for the frame the marker just ended.
    """
    return _marker("frame", None if seconds is None else _seconds(seconds))


def animate(seconds: Any, caller: Callable[[], str], loops: Any = 1) -> str:
    """Template call block: redraw the block's frames in place, `seconds` apart.

    `frame()` markers split the block into frames. `loops` repeats the whole set;
    0 loops until the player presses a key.
    """
    count = operator.index(loops)
    if count < 0:
        raise ValueError(f"loops must be a non-negative integer, not {loops!r}")
    return f"{SEP}anim:{_seconds(seconds)!r}:{count}{SEP}" + caller() + _marker("end")


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
    env.globals.update(pause=pause, rate=rate, typed=typed, frame=frame, animate=animate)
    return env


def render_screen(env: Environment, name: str, variables: dict[str, Any]) -> str:
    """Render screen `name` (timing markers included), or "" if no such screen exists."""
    try:
        template = env.get_template(name)
    except TemplateNotFound:
        return ""
    return _MARKER_ONLY_LINE.sub(r"\1", template.render(variables))


def render_text(env: Environment, source: str, variables: dict[str, Any]) -> str:
    """Render `source` as an ad-hoc screen template, with the same rules and timing."""
    return _MARKER_ONLY_LINE.sub(r"\1", env.from_string(source).render(variables))


def strip_timing(text: str) -> str:
    """`text` with its timing markers removed, for showing a screen all at once.

    An animation keeps only its last frame: the unpaced view is the end state.
    """
    parts = _MARKER.split(text)
    out: list[str] = []
    anim: list[str] | None = None  # frame text gathered since the last frame marker
    last_frame = ""
    depth = 0  # rate/typed blocks open inside the animation
    for i, part in enumerate(parts):
        if i % 2 == 0:
            (anim if anim is not None else out).append(part)
            continue
        command = part.partition(":")[0]
        if command == "anim":
            if anim is not None:
                raise ValueError("animations cannot nest")
            anim, last_frame, depth = [], "", 0
        elif command == "frame" and anim is not None:
            last_frame, anim = "".join(anim), []
        elif command in ("rate", "typed") and anim is not None:
            depth += 1
        elif command == "end" and anim is not None:
            if depth:
                depth -= 1
            else:
                final = "".join(anim)
                out.append(final or last_frame)
                anim = None
    return "".join(out)


def _collect_frames(parts: list[str], start: int) -> tuple[list[str], list[float | None], int]:
    """Split an animation block out of `parts`, where `start` is the first part after
    its `anim` marker. Returns frame texts, per-frame waits (None = block delay),
    and the index after the block. Timing markers inside a frame are dropped.
    """
    frames: list[str] = []
    delays: list[float | None] = []
    frame: list[str] = []
    depth = 0  # rate/typed blocks open inside the animation
    i = start
    while True:
        frame.append(parts[i])
        command, _, arg = parts[i + 1].partition(":")
        i += 2
        if command == "frame" and depth == 0:
            frames.append("".join(frame))
            frame = []
            delays.append(float(arg) if arg else None)
        elif command == "anim":
            raise ValueError("animations cannot nest")
        elif command in ("rate", "typed"):
            depth += 1
        elif command == "end":
            if depth == 0:
                frames.append("".join(frame))
                return frames, delays, i
            depth -= 1


REDRAW = "\x1b[0m\r\x1b[{}A\x1b[J"  # reset, column 0, up N lines, clear below


def _play_animation(frames: list[str], delays: list[float | None], default_delay: float,
                    loops: int, write: Callable[[str], None], sleep: Callable[[float], None],
                    interrupt: Callable[[], bool]) -> bool:
    """Redraw `frames` in place, waiting after each, for `loops` passes (0: until a key).

    Each frame must end with a newline, so the redraw can find the frame's first
    column again. A frame's wait comes from its `frame(seconds)` marker, or from
    the block delay when the marker carries none. True if a key stopped the loop.
    """
    loop, written_lines = 0, -1
    while loops == 0 or loop < loops:
        loop += 1
        final = loops != 0 and loop == loops
        for k, frame in enumerate(frames):
            if written_lines > 0:
                write(REDRAW.format(written_lines))
            elif written_lines == 0:
                write("\x1b[0m\x1b[J")
            write(frame)
            written_lines = frame.count("\n")
            if final and k == len(frames) - 1:
                return False
            delay = delays[k] if k < len(delays) else None
            if interrupt():
                return True
            sleep(default_delay if delay is None else delay)
    return False


def play_screen(text: str, write: Callable[[str], None], sleep: Callable[[float], None],
                line_delay: float = 0.0, interrupt: Callable[[], bool] | None = None) -> bool:
    """Write rendered `text`, sleeping as its timing markers direct.

    `line_delay` is the wait after each line outside any `rate` block. `interrupt`
    reports a keystroke already waiting; an animation stops when it says True.
    True if a key stopped an animation.
    """
    stop = interrupt or (lambda: False)
    stopped = False
    speeds = [(line_delay, 0.0)]  # stack of (seconds per line, seconds per character)
    parts = _MARKER.split(text)
    i = 0
    while i < len(parts):
        if i % 2 == 0:
            per_line, per_char = speeds[-1]
            if per_char > 0:
                for unit in _TYPED_UNIT.findall(parts[i]):
                    write(unit)
                    sleep(per_char)
                    if unit == "\n" and per_line > 0:
                        sleep(per_line)
            elif per_line > 0:
                for line in parts[i].splitlines(keepends=True):
                    write(line)
                    if line.endswith("\n"):
                        sleep(per_line)
            elif parts[i]:
                write(parts[i])
            i += 1
            continue
        command, _, arg = parts[i].partition(":")
        marker = parts[i]
        i += 1
        if command == "pause":
            sleep(float(arg))
        elif command == "rate":
            speeds.append((float(arg), speeds[-1][1]))
        elif command == "typed":
            speeds.append((speeds[-1][0], float(arg)))
        elif command == "end":
            if len(speeds) > 1:
                speeds.pop()
        elif command == "anim":
            seconds, _, loops = arg.partition(":")
            frames, delays, i = _collect_frames(parts, i)
            if frames:
                stopped = _play_animation(frames, delays, float(seconds), int(loops), write, sleep, stop) or stopped
        elif command != "frame":  # a frame marker outside an animation has nothing to redraw
            raise ValueError(f"unknown screen timing marker: {marker!r}")
    return stopped
