"""The BBS session: login, boot screen, main menu, authorization keys, and the file area.

Transport-agnostic: the SSH server and the local terminal both call `run_session` with a
byte channel. Screens are Jinja templates from `world/screens/`, falling back to `screens.DEFAULT_SCREENS`.
"""
from __future__ import annotations

import base64
import binascii
import traceback

from .context import Context
from .dos import run_dos
from .probe import DA1_REPLY, probe_sixel
from .screens import render_screen
from .scripts import HOOKS
from .state import StateStore, safe_username
from .terminal import Channel, LineReader, SessionClosed, Terminal
from .vfs import FsView, World

MAX_LOGIN_TRIES = 3
MAX_HANDLE = 32
DEFAULT_BOOT_DELAY = 0.05


def render(ctx: Context, name: str) -> str:
    """The text of screen `name`, rendered as a Jinja template (see `Context.screen_vars`)."""
    return render_screen(ctx.world.templates, name, ctx.screen_vars())


def show(ctx: Context, name: str, line_delay: float = 0.0) -> None:
    """Show screen `name`, honouring its timing calls when the session is paced.

    `line_delay` is the wait after each line outside any `rate` block. Without pacing
    (tests, or a caller with no terminal) the screen is written at once.
    """
    ctx.show_rendered(render(ctx, name), line_delay)


def decode_key(key: str) -> bytes | None:
    """Decode a base64 (standard or URL-safe, padding optional) key, or None if it isn't one."""
    padded = key + "=" * (-len(key) % 4)
    for altchars in (None, b"-_"):
        try:
            return base64.b64decode(padded, altchars=altchars, validate=True)
        except (binascii.Error, ValueError):
            continue
    return None


def login(ctx: Context) -> bool:
    """Ask for a handle and a password (anything goes). False if the caller hung up."""
    show(ctx, "login")
    for _ in range(MAX_LOGIN_TRIES):
        name = ctx.ask("USER NAME: ", record=False)
        if name is None:
            return False
        name = " ".join(name.split())[:MAX_HANDLE]
        if name:
            break
    else:
        return False
    if ctx.ask("PASSWORD: ", mask="*", record=False) is None:
        return False
    ctx.handle, ctx.username = name, safe_username(name)
    return True


def enter_key(ctx: Context) -> bool:
    """Prompt for an authorization key and judge it. False if the caller hung up."""
    raw = ctx.ask("\nAUTHORIZATION KEY: ")
    if raw is None:
        return False
    key = "".join(raw.split())
    if not key:
        return True
    payload = decode_key(key)
    accepted = False
    if payload is not None:
        handler = HOOKS.get("key")
        try:
            accepted = bool(handler(ctx, payload)) if handler else True
        except SessionClosed:
            raise
        except Exception:
            traceback.print_exc()
        ctx.store.add_key(ctx.username, key, accepted)
    show(ctx, "key_accepted" if accepted else "key_rejected")
    return True


def main_menu(ctx: Context) -> None:
    while True:
        show(ctx, "menu")
        choice = ctx.ask("SELECTION: ")
        if choice is None:
            return
        pick = choice.strip()[:1].upper()
        if pick == "K":
            if not enter_key(ctx):
                return
        elif pick == "F":
            show(ctx, "dos")
            if not run_dos(ctx):
                return
        elif pick in ("G", "Q"):
            show(ctx, "goodbye")
            return
        elif pick:
            ctx.term.line("\nINVALID SELECTION.")


def run_session(world: World, store: StateStore, channel: Channel, term: Terminal, *,
                source: str = "", pace: bool = True) -> tuple[int, Context]:
    """Run one caller's session to completion. Returns (exit status, context).

    Status is 0 when the caller logs off or sends EOF, 255 when the connection drops.
    `pace=False` disables all screen timing (for tests).
    """
    ctx = Context(world=world, store=store, term=term, reader=LineReader(channel, term),
                  fs=FsView(world), source=source, pace=pace)
    ctx.fs.on_flag = ctx.grant_flag
    if term.tty:
        # Consume the terminal's reply now, or key_ready() would mistake it for a keystroke.
        typed = bytearray()
        answer = probe_sixel(channel, typed=typed)
        ctx.sixel = bool(answer)
        if answer is None:
            ctx.reader.late_reply = DA1_REPLY
        ctx.reader.pending.extend(ctx.reader.decoder.decode(bytes(typed)))
    try:
        show(ctx, "boot", float(world.meta.get("boot_delay", DEFAULT_BOOT_DELAY)))
        if not login(ctx):
            return 0, ctx
        previous, ctx.session_id = store.begin_session(ctx.username, source)
        ctx.last_login, ctx.calls = previous.last_login, previous.session_count + 1
        main_menu(ctx)
        return 0, ctx
    except SessionClosed:
        return 255, ctx
