import pytest

from ssharg import scripts
from ssharg.context import Context
from ssharg.dos import parse, run_command
from ssharg.terminal import LineReader, Terminal
from ssharg.vfs import FsView, load_world

from .conftest import FakeChannel


@pytest.fixture
def run(tmp_path, store, monkeypatch):
    """run(line) -> output, in a world with C:\\BIN\\ECHO.EXE, C:\\BIN\\STUB.EXE and C:\\GAMES\\HELLO.EXE."""
    (tmp_path / "root" / "BIN").mkdir(parents=True)
    (tmp_path / "root" / "GAMES").mkdir()
    for path in ("BIN/ECHO.EXE", "BIN/STUB.EXE", "GAMES/HELLO.EXE"):
        (tmp_path / "root" / path).write_bytes(b"MZ")
    world = load_world(tmp_path)
    monkeypatch.setattr(scripts, "PROGRAMS", {})
    monkeypatch.setattr("ssharg.dos.PROGRAMS", scripts.PROGRAMS)
    scripts.program("echo")(lambda ctx, args: ctx.term.line("ECHO " + " ".join(args)))
    scripts.program("HELLO")(lambda ctx, args: ctx.term.line("HELLO"))
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))

    def go(line: str) -> str:
        mark = len(chan.sent)
        run_command(ctx, line)
        return chan.sent[mark:].decode()
    go.ctx = ctx
    return go


def test_program_runs_from_path_with_or_without_exe(run):
    assert run("echo too many secrets") == "ECHO too many secrets\n"
    assert run("ECHO.EXE a") == "ECHO a\n"
    run("cd games")
    assert run("echo b") == "ECHO b\n"


def test_program_runs_by_path_or_from_its_own_directory(run):
    assert run("hello") == "Bad command or file name\n"
    assert run("games\\hello") == "HELLO\n"
    assert run("C:\\GAMES\\HELLO.EXE") == "HELLO\n"
    run("cd games")
    assert run("hello") == "HELLO\n"


def test_unregistered_or_missing_program(run):
    assert run("stub") == "This program cannot be run in DOS mode. Try a program in C:\\BIN.\n"
    assert run("nope") == "Bad command or file name\n"
    assert run("bin") == "Bad command or file name\n"


def test_glued_forms_only_split_built_in_commands():
    assert parse("cd..") == ("CD", [".."], set())
    assert parse("games\\hello") == ("GAMES\\HELLO", [], set())


def test_ip_drops_the_port(run):
    ctx = run.ctx
    for source, ip in (("203.0.113.5:60882", "203.0.113.5"), ("::1:22", "::1"), ("local", "local"), ("", "")):
        ctx.source = source
        assert ctx.ip == ip


def test_type_renders_files_listed_as_templates(tmp_path, store):
    (tmp_path / "root").mkdir()
    (tmp_path / "root" / "NOTE.ME").write_text("{% if sixel %}\nPICTURE\n{% else %}\nno picture\n{% endif %}\n")
    (tmp_path / "root" / "PLAIN.TXT").write_text("{% if sixel %}\n")
    (tmp_path / "meta.json").write_text('{"templates": ["/note.me"]}')
    world = load_world(tmp_path)
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))
    run_command(ctx, "type note.me")
    ctx.sixel = True
    run_command(ctx, "type note.me")
    run_command(ctx, "type plain.txt")
    assert chan.text == "no picture\nPICTURE\n{% if sixel %}\n"


def test_type_shows_a_broken_template_as_plain_text(tmp_path, store, capsys):
    (tmp_path / "root").mkdir()
    (tmp_path / "root" / "NOTE.ME").write_text("{% if %}\n")
    (tmp_path / "meta.json").write_text('{"templates": ["/NOTE.ME"]}')
    world = load_world(tmp_path)
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))
    run_command(ctx, "type note.me")
    assert chan.text == "{% if %}\n"
    assert "TYPE /NOTE.ME: not a screen template" in capsys.readouterr().err
