"""Per-user persisted progress, one JSON file per user, written atomically."""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from pydantic import BaseModel, Field

MAX_SESSIONS_KEPT = 50
MAX_KEYS_KEPT = 100
_SAFE_NAME = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_username(name: str) -> str:
    """Map an arbitrary handle onto a safe storage name: `Dark Wren` -> `dark_wren`."""
    cleaned = "_".join(name.strip().lower().split())
    return cleaned if _SAFE_NAME.match(cleaned) else "guest"


class UserState(BaseModel):
    username: str
    first_login: str = ""
    last_login: str = ""
    session_count: int = 0
    found_flags: list[str] = Field(default_factory=list)
    keys: list[dict] = Field(default_factory=list)
    sessions: list[dict] = Field(default_factory=list)


class StateStore:
    def __init__(self, directory: str | os.PathLike) -> None:
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, username: str) -> Path:
        return self.dir / f"{safe_username(username)}.json"

    def load(self, username: str) -> UserState:
        path = self._path(username)
        try:
            data = json.loads(path.read_text("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("state is not an object")
            return UserState.model_validate(data)
        except FileNotFoundError:
            return UserState(username=safe_username(username))
        except (ValueError, TypeError, OSError):
            try:
                os.replace(path, path.with_suffix(".corrupt"))
            except OSError:
                pass
            return UserState(username=safe_username(username))

    def save(self, state: UserState) -> None:
        path = self._path(state.username)
        fd, tmp = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=".tmp", dir=self.dir)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(state.model_dump(), fh, indent=2)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def update(self, username: str, fn: Callable[[UserState], None]) -> UserState:
        """Load fresh, apply `fn`, save. Serialised so concurrent sessions merge."""
        with self._lock:
            state = self.load(username)
            fn(state)
            self.save(state)
            return state

    def begin_session(self, username: str, source: str) -> tuple[UserState, str]:
        """Record a login. Returns the state as it was before this login, and a session id."""
        session_id = uuid.uuid4().hex[:12]
        previous = UserState(username=safe_username(username))

        def apply(s: UserState) -> None:
            nonlocal previous
            previous = s.model_copy(deep=True)
            stamp = now_iso()
            s.first_login = s.first_login or stamp
            s.last_login = stamp
            s.session_count += 1
            s.sessions.append({"id": session_id, "start": stamp, "source": source, "commands": []})
            s.sessions = s.sessions[-MAX_SESSIONS_KEPT:]
        self.update(username, apply)
        return previous, session_id

    def record_command(self, username: str, session_id: str, line: str) -> None:
        def apply(s: UserState) -> None:
            for entry in reversed(s.sessions):
                if entry.get("id") == session_id:
                    entry["commands"].append(line)
                    return
            s.sessions.append({"id": session_id, "start": now_iso(), "source": "", "commands": [line]})
        self.update(username, apply)

    def add_flag(self, username: str, flag: str) -> bool:
        """Record a flag. Returns True if it was newly found."""
        added = False

        def apply(s: UserState) -> None:
            nonlocal added
            if flag not in s.found_flags:
                s.found_flags.append(flag)
                added = True
        self.update(username, apply)
        return added

    def add_key(self, username: str, key: str, accepted: bool) -> None:
        """Record an authorization key the player submitted (valid base64 only)."""
        def apply(s: UserState) -> None:
            s.keys.append({"key": key, "at": now_iso(), "accepted": accepted})
            s.keys = s.keys[-MAX_KEYS_KEPT:]
        self.update(username, apply)

    def has_flag(self, username: str, flag: str) -> bool:
        return flag in self.load(username).found_flags

    def reset(self, username: str) -> bool:
        try:
            self._path(username).unlink()
            return True
        except FileNotFoundError:
            return False

    def all_users(self) -> list[UserState]:
        return [self.load(p.stem) for p in sorted(self.dir.glob("*.json"))]
