"""World hooks. World authors register handlers from `world/scripts.py`.

Currently one hook: the authorization-key handler, which receives the decoded bytes of a
base64 key a player entered on the BBS and decides whether it is accepted.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from .context import Context

KeyHandler = Callable[["Context", bytes], bool]
HOOKS: dict[str, KeyHandler] = {}


def key_handler(fn: KeyHandler) -> KeyHandler:
    """Register `fn(ctx, payload) -> bool` to judge authorization keys.

    `payload` is the base64-decoded key. Return True to accept it (the `key_accepted`
    screen is shown) or False to reject it (`key_rejected`). The handler may print its
    own output with `ctx.term` first, and record progress with `ctx.grant_flag()`.
    """
    HOOKS["key"] = fn
    return fn


def load_world_scripts(world_dir: str | Path) -> None:
    HOOKS.clear()
    path = Path(world_dir) / "scripts.py"
    if not path.exists():
        return
    spec = importlib.util.spec_from_file_location("ssharg_world_scripts", path)
    if spec is None or spec.loader is None:
        return
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
