"""In-memory, read-only world filesystem with DOS semantics: case-insensitive names, no links."""
from __future__ import annotations

import json
import os
import time
from functools import cached_property
from pathlib import Path
from typing import Callable

from jinja2 import Environment
from pydantic import BaseModel, Field

from ..screens import make_environment

DIR, FILE = "dir", "file"
SKIP_NAMES = {".gitkeep"}
SCREEN_SUFFIXES = {".txt": "utf-8", ".ans": "cp437"}


class FsError(Exception):
    """A filesystem error. `reason` is a short, DOS-flavoured description."""

    def __init__(self, path: str, reason: str = "File not found") -> None:
        super().__init__(f"{path}: {reason}")
        self.path = path
        self.reason = reason


class Node(BaseModel):
    kind: str
    mtime: float = 0.0
    content: bytes = b""
    flags: list[str] = Field(default_factory=list)
    children: dict[str, Node] = Field(default_factory=dict)

    @property
    def is_dir(self) -> bool:
        return self.kind == DIR

    @property
    def size(self) -> int:
        return len(self.content)

    def child(self, name: str) -> tuple[str, Node] | None:
        """Find a child by name, ignoring case. Returns (stored name, node)."""
        if name in self.children:
            return name, self.children[name]
        folded = name.casefold()
        for stored, node in self.children.items():
            if stored.casefold() == folded:
                return stored, node
        return None


class World(BaseModel):
    """The loaded, immutable world: file tree, metadata, and BBS screens."""

    root: Node
    meta: dict
    banner: str = ""
    screens: dict[str, str] = Field(default_factory=dict)

    @property
    def name(self) -> str:
        return str(self.meta.get("name", "BBS"))

    @cached_property
    def templates(self) -> Environment:
        """The Jinja environment for this world's screens, built once and reused."""
        return make_environment(self.screens)


def _load_screens(directory: Path) -> dict[str, str]:
    """Read `screens/NAME.txt` (UTF-8) or `screens/NAME.ans` (CP437 ANSI art) into {NAME: text}."""
    screens: dict[str, str] = {}
    if not directory.is_dir():
        return screens
    for path in sorted(directory.iterdir()):
        encoding = SCREEN_SUFFIXES.get(path.suffix.lower())
        if encoding and path.is_file() and not path.is_symlink():
            screens[path.stem.lower()] = path.read_bytes().decode(encoding, "replace")
    return screens


def load_world(world_dir: str | os.PathLike) -> World:
    """Load `world_dir/root` into memory, applying `world_dir/meta.json`.

    Symlinks are skipped, never followed, so nothing outside the world tree is exposed.
    """
    base = Path(world_dir)
    tree = base / "root"
    if not tree.is_dir():
        raise FileNotFoundError(f"world tree not found: {tree}")
    meta_path = base / "meta.json"
    meta = json.loads(meta_path.read_text("utf-8")) if meta_path.exists() else {}
    banner_path = base / "banner.txt"
    banner = banner_path.read_text("utf-8") if banner_path.exists() else ""
    epoch = float(meta.get("epoch", time.time()))
    node_flags = {k.casefold(): v for k, v in meta.get("node_flags", {}).items()}

    def build(real: Path, vpath: str) -> Node:
        if real.is_dir():
            node = Node(kind=DIR, mtime=epoch)
            for child in sorted(real.iterdir()):
                if child.name in SKIP_NAMES or child.is_symlink():
                    continue
                node.children[child.name] = build(child, vpath.rstrip("/") + "/" + child.name)
        else:
            node = Node(kind=FILE, mtime=epoch, content=real.read_bytes())
        node.flags = list(node_flags.get(vpath.casefold(), []))
        return node

    return World(root=build(tree, "/"), meta=meta, banner=banner,
                 screens=_load_screens(base / "screens"))


def split(path: str) -> list[str]:
    return [p for p in path.split("/") if p not in ("", ".")]


class FsView:
    """One session's read-only view of the world: a current directory and flag recording."""

    def __init__(self, world: World, on_flag: Callable[[str], object] | None = None) -> None:
        self.root = world.root
        self.cwd = "/"
        self.on_flag = on_flag

    def resolve(self, path: str) -> str:
        """Return the canonical absolute path with stored-name casing.

        `..` at the root stays at the root, as in DOS. Raises FsError if a component is missing.
        """
        parts = split(path) if path.startswith("/") else split(self.cwd) + split(path)
        node, out = self.root, []
        for comp in parts:
            if comp == "..":
                if out:
                    out.pop()
                    node = self._walk(out)
                continue
            found = node.child(comp) if node.is_dir else None
            if found is None:
                raise FsError(path)
            out.append(found[0])
            node = found[1]
        return "/" + "/".join(out)

    def _walk(self, parts: list[str]) -> Node:
        node = self.root
        for name in parts:
            node = node.children[name]
        return node

    def lookup(self, path: str) -> Node:
        return self._walk(split(self.resolve(path)))

    def exists(self, path: str) -> bool:
        try:
            self.lookup(path)
            return True
        except FsError:
            return False

    def is_dir(self, path: str) -> bool:
        try:
            return self.lookup(path).is_dir
        except FsError:
            return False

    def listdir(self, path: str) -> list[tuple[str, Node]]:
        node = self.lookup(path)
        if not node.is_dir:
            raise FsError(path, "Not a directory")
        return sorted(node.children.items(), key=lambda item: item[0].casefold())

    def read(self, path: str, record: bool = True) -> bytes:
        node = self.lookup(path)
        if node.is_dir:
            raise FsError(path, "Access denied")
        if record and self.on_flag:
            for flag in node.flags:
                self.on_flag(flag)
        return node.content
