import json
import os

import pytest

from ssharg import cli
from ssharg.state import StateStore, safe_username


def test_safe_username():
    assert safe_username("Alice") == "alice"
    assert safe_username("  Dark   Wren ") == "dark_wren"
    assert safe_username("../../etc") == "guest"
    assert safe_username("") == "guest"
    assert safe_username("x" * 64) == "guest"


def test_begin_session_counts_and_history(store):
    prev, sid = store.begin_session("alice", "1.2.3.4:5")
    assert prev.session_count == 0
    store.record_command("alice", sid, "ls")
    prev2, _ = store.begin_session("alice", "1.2.3.4:6")
    assert prev2.session_count == 1
    state = store.load("alice")
    assert state.session_count == 2
    assert state.first_login and state.last_login
    assert state.sessions[0]["commands"] == ["ls"]
    assert state.sessions[1]["commands"] == []


def test_add_flag_is_idempotent(store):
    assert store.add_flag("alice", "lantern") is True
    assert store.add_flag("alice", "lantern") is False
    assert store.load("alice").found_flags == ["lantern"]
    assert store.has_flag("alice", "lantern")
    assert not store.has_flag("bob", "lantern")


def test_atomic_write_keeps_old_file_on_failure(store, monkeypatch):
    store.add_flag("alice", "lantern")
    before = (store.dir / "alice.json").read_text()

    def boom(*a, **k):
        raise OSError("disk full")
    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        store.add_flag("alice", "northlight")
    monkeypatch.undo()

    assert (store.dir / "alice.json").read_text() == before
    assert [p.name for p in store.dir.iterdir()] == ["alice.json"]
    assert store.load("alice").found_flags == ["lantern"]


def test_atomic_write_failure_during_dump_leaves_no_temp(store, monkeypatch):
    store.add_flag("alice", "lantern")

    def boom(*a, **k):
        raise RuntimeError("crash mid-write")
    monkeypatch.setattr(json, "dump", boom)
    with pytest.raises(RuntimeError):
        store.add_flag("alice", "northlight")
    monkeypatch.undo()
    assert [p.name for p in store.dir.iterdir()] == ["alice.json"]
    assert store.load("alice").found_flags == ["lantern"]


def test_corrupt_state_recovers_fresh(store):
    (store.dir / "alice.json").write_text("{ not json")
    state = store.load("alice")
    assert state.found_flags == [] and state.username == "alice"
    assert (store.dir / "alice.corrupt").exists()
    store.add_flag("alice", "lantern")
    assert store.load("alice").found_flags == ["lantern"]


def test_reset_and_list(store, capsys):
    store.begin_session("alice", "x")
    store.add_flag("bob", "lantern")
    assert {u.username for u in store.all_users()} == {"alice", "bob"}
    assert cli.main(["--state-dir", str(store.dir), "--list-users"]) == 0
    out = capsys.readouterr().out
    assert "alice" in out and "bob" in out
    assert cli.main(["--state-dir", str(store.dir), "--reset-user", "alice"]) == 0
    assert "cleared alice" in capsys.readouterr().out
    assert {u.username for u in store.all_users()} == {"bob"}
    assert store.reset("alice") is False


def test_add_key_records_and_caps(store):
    store.add_key("alice", "Zm9v", accepted=False)
    store.add_key("alice", "YmFy", accepted=True)
    keys = store.load("alice").keys
    assert [(k["key"], k["accepted"]) for k in keys] == [("Zm9v", False), ("YmFy", True)]
    for i in range(150):
        store.add_key("alice", f"k{i}", accepted=False)
    assert len(store.load("alice").keys) == 100


def test_flag_discovery_through_dos_is_persisted(dos, store):
    out = dos("TYPE C:\\USERS\\KADE\\.NOTES\\.LANTERN")
    assert "the lantern is lit" in out and "signal" not in out
    assert StateStore(store.dir).load("alice").found_flags == ["lantern"]
