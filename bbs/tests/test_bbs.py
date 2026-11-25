import base64
import re

from ssharg.bbs import decode_key

ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def test_password_is_masked_on_tty(dial):
    _, _, chan = dial("wren", "secret", "G", tty=True)
    assert "PASSWORD: ******\r\n" in ANSI.sub("", chan.text)
    assert "secret" not in chan.text


def test_blank_names_retry_then_hang_up(dial, store):
    code, ctx, chan = dial("", "  ", "")
    assert code == 0 and chan.text.count("USER NAME:") == 3
    assert not ctx.session_id and store.all_users() == []


def test_eof_during_login_and_menu(dial):
    code, ctx, _ = dial("wren")
    assert code == 0 and not ctx.session_id
    code, ctx, _ = dial("wren", "pw")
    assert code == 0 and ctx.session_id


def test_invalid_menu_choice_and_redisplay(dial):
    _, _, chan = dial("wren", "", "Z", "", "G")
    assert "INVALID SELECTION." in chan.text
    assert chan.text.count("MAIN MENU") == 3


def test_decode_key_variants():
    assert decode_key("Zm9vYmFy") == b"foobar"
    assert decode_key("Zm9vYg") == b"foob"
    assert decode_key("_-8") == b"\xff\xef"
    assert decode_key("not base64!") is None


def test_non_base64_key_rejected_and_not_recorded(dial, store):
    _, _, chan = dial("wren", "", "K", "hello world!", "G")
    assert "INVALID AUTHORIZATION KEY" in chan.text
    assert store.load("wren").keys == []


def test_key_needs_lantern_then_opens_relay(dial, store):
    key = b64("NORTHLIGHT")
    _, _, chan = dial("wren", "", "K", key, "G")
    assert "no carrier" in chan.text and "INVALID AUTHORIZATION KEY" in chan.text
    _, _, chan = dial("wren", "", "F", "type \\users\\kade\\.notes\\.lantern", "exit", "K", key, "G")
    assert "remote identifies as: LANTERN" in chan.text and "KEY ACCEPTED" in chan.text
    state = store.load("wren")
    assert state.found_flags == ["lantern", "northlight"]
    assert [(k["key"], k["accepted"]) for k in state.keys] == [(key, False), (key, True)]


def test_journal_note_works_as_a_key(dial, store):
    note = "d2hlbiB0aGUgbGFudGVybiBidXJucywgc2F5IE5PUlRITElHSFQgdG8gdGhlIHJlbGF5"
    store.add_flag("wren", "lantern")
    _, _, chan = dial("wren", "", "k", note, "G")
    assert "KEY ACCEPTED" in chan.text


def test_key_handler_absent_accepts_any_base64(dial, store, monkeypatch):
    from ssharg import scripts
    monkeypatch.setattr(scripts, "HOOKS", {})
    monkeypatch.setattr("ssharg.bbs.HOOKS", {})
    _, _, chan = dial("wren", "", "K", b64("anything"), "G")
    assert "KEY ACCEPTED" in chan.text


def test_key_handler_crash_rejects(dial, store, monkeypatch):
    def boom(ctx, payload):
        raise RuntimeError("bad handler")
    monkeypatch.setattr("ssharg.bbs.HOOKS", {"key": boom})
    code, _, chan = dial("wren", "", "K", b64("x"), "G")
    assert code == 0 and "INVALID AUTHORIZATION KEY" in chan.text


def test_disconnect_mid_session_returns_255(dial):
    code, _, _ = dial("wren", "", "F", "dir", fail_after=12)
    assert code == 255


def test_line_editing_ctrl_c_backspace_and_escape(dial):
    raw = [b"wren\r", b"\r", b"F\r", b"rm x\x03", b"dirx\x7f\r", b"\x1b[A", b"exit\r", b"G\r"]
    _, ctx, chan = dial(raw=raw, tty=True)
    assert ctx.history == ["F", "dir", "exit", "G"]
    assert "^C" in chan.text and "Directory of C:\\" in chan.text
