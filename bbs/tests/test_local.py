import os

from ssharg.local import LocalChannel, run_local


def _pipes(stdin: bytes):
    """A LocalChannel reading `stdin` from a pipe and writing to pipes. Returns (chan, collect)."""
    in_r, in_w = os.pipe()
    out_r, out_w = os.pipe()
    err_r, err_w = os.pipe()
    os.write(in_w, stdin)
    os.close(in_w)

    def collect() -> str:
        for fd in (in_r, out_w, err_w):
            os.close(fd)
        os.close(err_r)
        with os.fdopen(out_r, "rb") as o:
            return o.read().decode()
    return LocalChannel(in_r, out_w, err_w), collect


def test_run_local_piped_session(world, store):
    chan, collect = _pipes(b"bob\npw\nF\ntype readme.txt\nexit\nG\n")
    assert run_local(world, store, channel=chan, pace=False) == 0
    out = collect()
    assert "Welcome to the Nomos Control BBS." in out and "NO CARRIER" in out
    assert store.load("bob").session_count == 1