import os

import pytest

from ssharg.vfs import FsError, FsView, load_world


@pytest.fixture
def fs(world):
    view = FsView(world)
    view.cwd = "/USERS/KADE"
    return view


@pytest.mark.parametrize("path,expected", [
    ("/README.TXT", "/README.TXT"),
    ("/readme.txt", "/README.TXT"),
    ("journal.txt", "/USERS/KADE/JOURNAL.TXT"),
    ("./.notes/../Journal.Txt", "/USERS/KADE/JOURNAL.TXT"),
    ("..", "/USERS"),
    ("../../../..", "/"),
    ("/..", "/"),
    ("//docs///inc0413.txt", "/DOCS/INC0413.TXT"),
    ("/", "/"),
])
def test_resolve_is_case_insensitive_and_clamps_at_root(fs, path, expected):
    assert fs.resolve(path) == expected


def test_missing_and_not_a_directory(fs):
    with pytest.raises(FsError):
        fs.lookup("/nope")
    with pytest.raises(FsError):
        fs.lookup("/README.TXT/x")
    with pytest.raises(FsError, match="Not a directory"):
        fs.listdir("/README.TXT")
    with pytest.raises(FsError, match="Access denied"):
        fs.read("/DOCS")


def test_listdir_sorted_case_insensitively(fs):
    assert [n for n, _ in fs.listdir("/")] == ["DOCS", "LOGS", "README.TXT", "USERS"]
    assert [n for n, _ in fs.listdir(".")] == [".NOTES", "JOURNAL.TXT", "TODO.TXT"]


def test_read_records_flags_once_per_read(world):
    seen = []
    view = FsView(world, on_flag=seen.append)
    view.read("/USERS/KADE/.NOTES/.OVERRIDE")
    view.read("/USERS/KADE/.NOTES/.OVERRIDE", record=False)
    assert seen == ["override"]


def test_symlinks_skipped_and_ansi_screens_decoded(tmp_path):
    (tmp_path / "root").mkdir()
    (tmp_path / "root" / "A.TXT").write_text("a")
    (tmp_path / "root" / ".gitkeep").write_text("")
    os.symlink("/etc/passwd", tmp_path / "root" / "LEAK")
    (tmp_path / "screens").mkdir()
    (tmp_path / "screens" / "menu.ans").write_bytes(b"\xc9\xcd\xbb")
    world = load_world(tmp_path)
    assert set(world.root.children) == {"A.TXT"}
    assert world.screens["menu"] == "╔═╗"
