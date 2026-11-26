"""A small, read-only DOS-style prompt over the world filesystem.

Paths use `\\`, are case-insensitive, and may start with `C:`. Arguments starting with `/`
are switches. Names starting with `.` are hidden from DIR unless `/A` is given.
"""
from __future__ import annotations

import re
import time
import traceback
from typing import Callable

from .context import Context
from .screens import render_text
from .vfs import FsError, Node

DRIVE = "C"
Command = Callable[[Context, list[str], set[str]], bool]
COMMANDS: dict[str, tuple[Command, str]] = {}
ALIASES = {"LS": "DIR", "CHDIR": "CD"}
_GLUED = re.compile(r"^([A-Za-z]+)(\\.*|/.*|\.\..*)$")


class DosError(Exception):
    """A user-facing DOS error message."""


def command(name: str, summary: str) -> Callable[[Command], Command]:
    def register(fn: Command) -> Command:
        COMMANDS[name] = (fn, summary)
        return fn
    return register


def to_vfs(arg: str) -> str:
    """`C:\\USERS\\KADE` -> `/USERS/KADE`; relative paths stay relative."""
    if len(arg) >= 2 and arg[1] == ":":
        if arg[0].upper() != DRIVE:
            raise DosError("Invalid drive specification")
        arg = arg[2:]
    return arg.replace("\\", "/")


def to_dos(path: str) -> str:
    """`/USERS/kade` -> `C:\\USERS\\KADE`."""
    return f"{DRIVE}:\\" + "\\".join(p for p in path.split("/") if p).upper()


def prompt(ctx: Context) -> str:
    return f"{to_dos(ctx.fs.cwd)}>"


def _stamp(node: Node) -> str:
    t = time.gmtime(node.mtime)
    hour = t.tm_hour % 12 or 12
    return f"{t.tm_mon:02d}-{t.tm_mday:02d}-{t.tm_year % 100:02d}  {hour:2d}:{t.tm_min:02d}{'a' if t.tm_hour < 12 else 'p'}"


def _entry(name: str, node: Node) -> str:
    size = "<DIR>         " if node.is_dir else f"{node.size:>14,}"
    return f"{_stamp(node)}  {size} {name.upper()}"


@command("DIR", "List files in a directory.  DIR [path] [/A shows hidden files]")
def dir_(ctx: Context, args: list[str], switches: set[str]) -> bool:
    target = to_vfs(args[0]) if args else "."
    try:
        canon = ctx.fs.resolve(target)
        node = ctx.fs.lookup(canon)
    except FsError:
        raise DosError("File Not Found")
    out = ctx.term
    out.line(f" Volume in drive {DRIVE} is {ctx.world.meta.get('volume', ctx.world.name).upper()}")
    if not node.is_dir:
        parent = canon.rsplit("/", 1)[0] or "/"
        out.line(f" Directory of {to_dos(parent)}")
        out.line()
        out.line(_entry(canon.rsplit("/", 1)[1], node))
        out.line(f"{1:>16} file(s) {node.size:>14,} bytes")
        return False
    out.line(f" Directory of {to_dos(canon)}")
    out.line()
    show_hidden = "/A" in switches
    entries = [(n, c) for n, c in ctx.fs.listdir(canon) if show_hidden or not n.startswith(".")]
    if canon != "/":
        out.line(_entry(".", node))
        out.line(_entry("..", node))
    for name, child in entries:
        out.line(_entry(name, child))
    files = [c for _, c in entries if not c.is_dir]
    dirs = len(entries) - len(files) + (2 if canon != "/" else 0)
    out.line(f"{len(files):>16} file(s) {sum(c.size for c in files):>14,} bytes")
    out.line(f"{dirs:>16} dir(s)")
    return False


@command("CD", "Show or change the current directory.  CD [path], CD .., CD \\")
def cd(ctx: Context, args: list[str], switches: set[str]) -> bool:
    if not args:
        ctx.term.line(to_dos(ctx.fs.cwd))
        return False
    try:
        canon = ctx.fs.resolve(to_vfs(args[0]))
    except FsError:
        raise DosError("Invalid directory")
    if not ctx.fs.is_dir(canon):
        raise DosError("Invalid directory")
    ctx.fs.cwd = canon
    return False


@command("TYPE", "Display the contents of a text file.  TYPE file")
def type_(ctx: Context, args: list[str], switches: set[str]) -> bool:
    if not args:
        raise DosError("Required parameter missing")
    try:
        data = ctx.fs.read(to_vfs(args[0]))
    except FsError as exc:
        raise DosError("Access denied" if exc.reason == "Access denied" else f"File not found - {args[0].upper()}")
    text = data.decode("utf-8", "replace")
    ctx.term.write(text if text.endswith("\n") or not text else text + "\n")
    return False


@command("PLAY", "Play an animation file.  PLAY file")
def play(ctx: Context, args: list[str], switches: set[str]) -> bool:
    """Render the file as a screen template and honour its timing and animation blocks."""
    if not args:
        raise DosError("Required parameter missing")
    arg = args[0]
    try:
        canon = ctx.fs.resolve(to_vfs(arg))
        data = ctx.fs.read(canon)
    except FsError as exc:
        raise DosError("Access denied" if exc.reason == "Access denied" else f"File not found - {arg.upper()}")
    source = data.decode("cp437" if canon.lower().endswith(".ans") else "utf-8", "replace")
    ctx.show_rendered(render_text(ctx.world.templates, source, ctx.screen_vars()))
    return False


@command("CLS", "Clear the screen.")
def cls(ctx: Context, args: list[str], switches: set[str]) -> bool:
    ctx.term.clear()
    return False


@command("VER", "Show the system version.")
def ver(ctx: Context, args: list[str], switches: set[str]) -> bool:
    ctx.term.line()
    ctx.term.line(str(ctx.world.meta.get("dos_version", "DOS Version 6.22")))
    ctx.term.line()
    return False


@command("HELP", "List available commands.")
def help_(ctx: Context, args: list[str], switches: set[str]) -> bool:
    for name, (_, summary) in sorted(COMMANDS.items()):
        ctx.term.line(f"{name:<8} {summary}")
    ctx.term.line(f"{'LS':<8} Same as DIR.")
    return False


@command("EXIT", "Return to the BBS menu.")
def exit_(ctx: Context, args: list[str], switches: set[str]) -> bool:
    return True


def parse(line: str) -> tuple[str, list[str], set[str]]:
    """Split a command line into (COMMAND, args, {/SWITCHES}). Handles `cd..` and `dir/a`."""
    tokens = line.split()
    if not tokens:
        return "", [], set()
    glued = _GLUED.match(tokens[0])
    if glued:
        tokens[:1] = [glued.group(1), glued.group(2)]
    name = tokens[0].upper()
    args, switches = [], set()
    for tok in tokens[1:]:
        if tok.startswith("/"):
            switches.update("/" + s.upper() for s in tok.split("/") if s)
        elif name in ("LS", "DIR") and tok.startswith("-"):
            if "a" in tok.lower():
                switches.add("/A")
        else:
            args.append(tok)
    return ALIASES.get(name, name), args, switches


def run_command(ctx: Context, line: str) -> bool:
    """Run one line. Returns True if the player asked to leave the prompt."""
    name, args, switches = parse(line)
    if not name:
        return False
    if len(name) == 2 and name[1] == ":":
        if name[0] != DRIVE:
            ctx.term.line("Invalid drive specification")
        return False
    entry = COMMANDS.get(name)
    if entry is None:
        ctx.term.line("Bad command or file name")
        return False
    try:
        return entry[0](ctx, args, switches)
    except DosError as exc:
        ctx.term.line(str(exc))
    except FsError:
        ctx.term.line("File not found")
    except Exception:
        traceback.print_exc()
        ctx.term.line("General failure")
    return False


def run_dos(ctx: Context) -> bool:
    """Run the prompt until EXIT (returns True) or end of input (returns False)."""
    while True:
        ctx.term.line()
        line = ctx.ask(prompt(ctx))
        if line is None:
            return False
        if run_command(ctx, line):
            return True
