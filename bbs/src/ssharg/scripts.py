"""World hooks. World authors register handlers from `world/scripts.py`.

Two kinds of hook: the authorization-key handler, which receives the key a player entered
on the BBS and decides whether it is accepted, and programs, which run when a player types
the name of a `.EXE` file at the DOS prompt.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from .context import Context

KeyHandler = Callable[["Context", str], bool]
Program = Callable[["Context", list[str]], None]
HOOKS: dict[str, KeyHandler] = {}
PROGRAMS: dict[str, Program] = {}


def key_handler(fn: KeyHandler) -> KeyHandler:
    """Register `fn(ctx, key) -> bool` to judge authorization keys.

    `key` is the text the player typed, with all whitespace removed. Return True to accept it (the `key_accepted`
    screen is shown) or False to reject it (`key_rejected`). The handler may print its
    own output with `ctx.term` first, and record progress with `ctx.grant_flag()`.
    """
    HOOKS["key"] = fn
    return fn


def program(name: str) -> Callable[[Program], Program]:
    """Register `fn(ctx, args)` to run when the player runs `NAME.EXE` from the DOS prompt.

    The file `NAME.EXE` must exist in the world tree; the player runs it by name from its own
    directory or from `\\BIN`, or by path. `args` are the words typed after the name.
    """
    def register(fn: Program) -> Program:
        PROGRAMS[name.upper()] = fn
        return fn
    return register


def load_world_scripts(world_dir: str | Path) -> None:
    HOOKS.clear()
    PROGRAMS.clear()
    path = Path(world_dir) / "scripts.py"
    if not path.exists():
        return
    spec = importlib.util.spec_from_file_location("ssharg_world_scripts", path)
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
