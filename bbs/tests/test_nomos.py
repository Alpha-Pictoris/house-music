"""The Nomos Control Center puzzle in the shipped world."""
import re
from types import SimpleNamespace

import pytest

from ssharg.scripts import HOOKS


@pytest.fixture
def auth_key(world):
    """auth_key(ip, username) -> the key ELEVATE issues to that caller."""
    world_auth_key = HOOKS["key"].__globals__["auth_key"]
    return lambda ip, username: world_auth_key(SimpleNamespace(ip=ip, username=username))


def test_key_is_five_characters_and_depends_on_ip_and_name(auth_key):
    key = auth_key("test", "wren")
    assert re.fullmatch(r"[A-Z2-9]{5}", key)
    assert auth_key("test", "wren") == key
    assert auth_key("203.0.113.5", "wren") != key
    assert auth_key("test", "kronos") != key


def test_secrets_and_note_point_at_the_anagram(dos):
    assert "SETEC ASTRONOMY" in dos("type \\user\\kronos\\secrets.txt")
    note = dos("type \\user\\kronos\\find.me")
    assert "Sneakers" in note and "pencil drawing of one old sneaker" in note
    assert "\x1bP" not in note


def test_note_shows_the_sneaker_on_a_sixel_terminal(dos):
    dos.ctx.sixel = True
    note = dos("type \\user\\kronos\\find.me")
    assert "\x1bP0;1;0q" in note and note.count("\x1b\\") == 1
    assert "pencil drawing" not in note


def test_elevate_refuses_the_scrambled_password(dos):
    out = dos("elevate setec astronomy")
    assert "ACCESS DENIED." in out and "C:\\USER\\KRONOS" in out
    assert not dos.ctx.has_flag("elevated")


def test_elevate_issues_the_callers_key(dos, auth_key):
    dos.ctx.source = "203.0.113.5:60882"
    out = dos("C:\\BIN\\ELEVATE.EXE  too   many secrets")
    assert f"AUTHORIZATION KEY: {auth_key('203.0.113.5', 'alice')}" in out
    assert "Type EXIT" in out and dos.ctx.has_flag("elevated")


def test_reboot_needs_the_key_then_ends_the_chapter(dos, store):
    out = dos("reboot")
    assert "REBOOT FAILED" in out and "TO BE CONTINUED" not in out
    store.add_flag("alice", "authorized")
    out = dos("bin\\reboot")
    assert "TO BE CONTINUED..." in out and dos.ctx.has_flag("rebooted")


def test_status_follows_progress(dos, store):
    assert "Access ........... GUEST" in dos("status")
    assert "one note per item" in dos("status")
    store.add_flag("alice", "rebooted")
    assert "RESTARTED" in dos("status")


def test_wrong_key_is_rejected_with_a_remedy(dial, store):
    _, _, chan = dial("wren", "", "K", "AAAAA", "G")
    assert "INVALID AUTHORIZATION KEY" in chan.text and "ELEVATE.EXE" in chan.text
    assert not store.has_flag("wren", "authorized")


def test_whole_puzzle_in_one_call(dial, store, auth_key):
    key = auth_key("test", "wren").lower()
    _, ctx, chan = dial("wren", "", "F", "cd user\\kronos", "type secrets.txt", "elevate", "Too Many Secrets",
                        "exit", "K", key, "F", "reboot", "exit", "G")
    assert "KEY ACCEPTED" in chan.text and "TO BE CONTINUED..." in chan.text
    assert "Restarted" in chan.text.rsplit("MAIN MENU", 1)[1]
    assert store.load("wren").found_flags == ["elevated", "authorized", "rebooted"]
    assert "Too Many Secrets" not in ctx.history
