import re

from ssharg.context import Context
from ssharg.dos import parse, prompt, run_command, to_dos, to_vfs
from ssharg.terminal import LineReader, Terminal
from ssharg.vfs import FsView, load_world

from .conftest import FakeChannel


def test_parse_handles_switches_aliases_and_glued_forms():
    assert parse("dir /a") == ("DIR", [], {"/A"})
    assert parse("DIR/A/W") == ("DIR", [], {"/A", "/W"})
    assert parse("ls -la docs") == ("DIR", ["docs"], {"/A"})
    assert parse("cd..") == ("CD", [".."], set())
    assert parse("cd\\") == ("CD", ["\\"], set())
    assert parse("chdir docs") == ("CD", ["docs"], set())
    assert parse("type readme.txt") == ("TYPE", ["readme.txt"], set())
    assert parse("   ") == ("", [], set())


def test_path_translation():
    assert to_vfs("C:\\USER\\KRONOS") == "/USER/KRONOS"
    assert to_vfs("c:docs") == "docs"
    assert to_vfs("..\\BIN") == "../BIN"
    assert to_dos("/") == "C:\\"
    assert to_dos("/USER/kronos") == "C:\\USER\\KRONOS"


def test_dir_lists_root(dos):
    out = dos("DIR")
    assert " Volume in drive C is NOMOS" in out
    assert " Directory of C:\\" in out
    assert re.search(r"<DIR>\s+BIN", out)
    assert re.search(r"04-13-24\s+\d+:\d\d[ap]\s+\d+ README.TXT", out)
    assert "1 file(s)" in out and "2 dir(s)" in out


def test_dir_hides_dotfiles_unless_all(tmp_path, store):
    (tmp_path / "root" / "HOME" / ".NOTES").mkdir(parents=True)
    world = load_world(tmp_path)
    chan = FakeChannel()
    term = Terminal(chan, tty=False)
    ctx = Context(world=world, store=store, term=term, reader=LineReader(chan, term), fs=FsView(world))

    def dos(line: str) -> str:
        mark = len(chan.sent)
        run_command(ctx, line)
        return chan.sent[mark:].decode()
    dos("cd home")
    assert ".NOTES" not in dos("dir")
    assert ".NOTES" in dos("dir /a")
    assert ".NOTES" in dos("ls -a")
    assert "  .." in dos("dir")


def test_dir_of_single_file_and_missing(dos):
    assert "SECRETS.TXT" in dos("dir c:\\user\\kronos\\secrets.txt")
    assert dos("dir nowhere") == "File Not Found\n"


def test_cd_navigation_and_prompt(dos):
    assert prompt(dos.ctx) == "C:\\>"
    assert dos("cd user") == ""
    assert dos("cd kronos") == ""
    assert prompt(dos.ctx) == "C:\\USER\\KRONOS>"
    assert dos("cd") == "C:\\USER\\KRONOS\n"
    dos("cd..")
    assert dos.ctx.fs.cwd == "/USER"
    dos("cd\\")
    assert dos.ctx.fs.cwd == "/"
    dos("cd ..")
    assert dos.ctx.fs.cwd == "/"
    assert dos("cd readme.txt") == "Invalid directory\n"
    assert dos("cd nope") == "Invalid directory\n"


def test_type(dos):
    assert "Welcome to the Nomos Control BBS." in dos("type readme.txt")
    assert dos("TYPE") == "Required parameter missing\n"
    assert dos("type bin") == "Access denied\n"
    assert dos("type nope.txt") == "File not found - NOPE.TXT\n"


def test_drives_unknown_commands_and_exit(dos):
    assert dos("C:") == ""
    assert dos("A:") == "Invalid drive specification\n"
    assert dos("dir a:\\") == "Invalid drive specification\n"
    assert dos("rm readme.txt") == "Bad command or file name\n"
    assert dos("copy readme.txt x.txt") == "Bad command or file name\n"
    assert "TYPE" in dos("help") and "LS" in dos("help")
    assert "NOMOS DOS" in dos("ver")
    assert dos.left is False
    dos("exit")
    assert dos.left is True
