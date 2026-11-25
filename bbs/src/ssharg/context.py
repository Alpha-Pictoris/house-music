"""Per-session context shared by the BBS, the DOS prompt, and world hooks."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

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

    def ask(self, prompt: str, mask: str | None = None, record: bool = True) -> str | None:
        """Prompt for a line. Records it in the session history unless `record` is False."""
        line = self.reader.read_line(prompt, mask)
        if line is not None and record and line.strip() and self.session_id:
            self.history.append(line.strip())
            self.store.record_command(self.username, self.session_id, line.strip())
        return line

    def has_flag(self, flag: str) -> bool:
        return self.store.has_flag(self.username, flag)

    def grant_flag(self, flag: str) -> bool:
        """Record a flag for this player. Returns True if it is new."""
        return self.store.add_flag(self.username, flag)

    def found_flags(self) -> list[str]:
        return self.store.load(self.username).found_flags
