"""Per-session context shared by the BBS, the DOS prompt, and world hooks."""
from __future__ import annotations

import time

from pydantic import BaseModel, ConfigDict, Field

from .screens import play_screen, strip_timing
from .state import StateStore
from .terminal import LineReader, Terminal
from .vfs import FsView, World


class Context(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    world: World
    store: StateStore
    term: Terminal
    reader: LineReader
    fs: FsView
    username: str = "guest"
    handle: str = "GUEST"
    source: str = ""
    session_id: str = ""
    pace: bool = True
    last_login: str = ""
    calls: int = 0
    history: list[str] = Field(default_factory=list)
    nomos_state: str = "Degraded"
    sixel: bool = False

    @property
    def ip(self) -> str:
        """The caller's address without the port: `203.0.113.5` for `203.0.113.5:60882`."""
        host, sep, port = self.source.rpartition(":")
        return host if sep and port.isdigit() else self.source

    def ask(self, prompt: str, mask: str | None = None, record: bool = True) -> str | None:
        """Prompt for a line. Records it in the session history unless `record` is False."""
        line = self.reader.read_line(prompt, mask)
        if line is not None and record and line.strip() and self.session_id:
            self.history.append(line.strip())
            self.store.record_command(self.username, self.session_id, line.strip())
        return line

    def screen_vars(self) -> dict[str, object]:
        """The variables every screen template can use."""
        return {
            "bbs": self.world.name,
            "user": self.handle,
            "last_login": self.last_login or "never",
            "calls": self.calls,
            "nomos_state": self.nomos_state,
            "sixel": self.sixel,
            "meta": self.world.meta,
            "ctx": self,
        }

    def key_ready(self) -> bool:
        """True when a keystroke is already waiting for the reader."""
        return self.reader.key_waiting()

    def show_rendered(self, text: str, line_delay: float = 0.0) -> None:
        """Write a rendered screen: paced on a live terminal, all at once otherwise.

        The key that stops an animation is discarded, so it does not reach the next prompt.
        """
        if self.pace and self.term.tty:
            if play_screen(text, self.term.write, time.sleep, line_delay, self.key_ready):
                self.reader.discard_waiting()
        else:
            self.term.write(strip_timing(text))

    def has_flag(self, flag: str) -> bool:
        return self.store.has_flag(self.username, flag)

    def grant_flag(self, flag: str) -> bool:
        """Record a flag for this player. Returns True if it is new."""
        return self.store.add_flag(self.username, flag)

    def found_flags(self) -> list[str]:
        return self.store.load(self.username).found_flags
