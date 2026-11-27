import os

import pytest

from ssharg.vfs import FsError, FsView, load_world


@pytest.fixture
def fs(world):
    view = FsView(world)
    view.cwd = "/USER/KRONOS"
    return view


@pytest.mark.parametrize("path,expected", [
    ("/README.TXT", "/README.TXT"),
    ("/readme.txt", "/README.TXT"),
    ("secrets.txt", "/USER/KRONOS/SECRETS.TXT"),
    ("./../kronos/Secrets.Txt", "/USER/KRONOS/SECRETS.TXT"),
    ("..", "/USER"),
    ("../../../..", "/"),
    ("/..", "/"),
    ("//bin///elevate.exe", "/BIN/ELEVATE.EXE"),
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
        fs.read("/BIN")


def test_listdir_sorted_case_insensitively(fs):
    assert [n for n, _ in fs.listdir("/")] == ["BIN", "README.TXT", "USER"]
    assert [n for n, _ in fs.listdir(".")] == ["FIND.ME", "SECRETS.TXT"]


def test_read_records_flags_once_per_read(tmp_path):
    (tmp_path / "root" / "NOTES").mkdir(parents=True)
    (tmp_path / "root" / "NOTES" / "KEY.TXT").write_text("key")
    (tmp_path / "meta.json").write_text('{"node_flags": {"/NOTES/KEY.TXT": ["found"]}}')
    seen = []
    view = FsView(load_world(tmp_path), on_flag=seen.append)
    view.read("/notes/key.txt")
    view.read("/NOTES/KEY.TXT", record=False)
    assert seen == ["found"]


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
