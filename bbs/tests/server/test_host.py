import io
from pathlib import Path

import paramiko
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa

from ssharg.certs import issue
from ssharg.server import SERVER_VERSION, ArgServer

CA = ed25519.Ed25519PrivateKey.generate()

KEY_TYPES = {
    "ed25519": (ed25519.Ed25519PrivateKey.generate, paramiko.Ed25519Key),
    "rsa": (lambda: rsa.generate_private_key(65537, 2048), paramiko.RSAKey),
    "ecdsa": (lambda: ec.generate_private_key(ec.SECP256R1()), paramiko.ECDSAKey),
}


def player_key(kind="ed25519"):
    generate, key_class = KEY_TYPES[kind]
    private = generate()
    pem = private.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH, serialization.NoEncryption()
    ).decode()
    return private, key_class.from_private_key(io.StringIO(pem))


def certified_key(kind="ed25519", name="dana", userdata=b"lamp in the hall", ca=CA) -> paramiko.PKey:
    private, key = player_key(kind)
    key.load_certificate(issue(ca, private.public_key(), name, userdata, days=1).public_bytes().decode())
    return key


def server(banner: str = "") -> ArgServer:
    return ArgServer(CA.public_key(), banner)


def test_without_a_ca_anyone_logs_in_with_none():
    s = ArgServer()
    assert s.get_allowed_auths("dana") == "none"
    assert s.check_auth_none("dana") == paramiko.AUTH_SUCCESSFUL
    assert s.username == "dana"
    assert s.check_auth_password("dana", "hunter2") == paramiko.AUTH_FAILED
    assert s.check_auth_publickey("dana", certified_key()) == paramiko.AUTH_FAILED


def test_with_a_ca_only_certificates_log_in():
    s = server()
    assert s.get_allowed_auths("dana") == "publickey"
    assert s.check_auth_none("dana") == paramiko.AUTH_FAILED
    assert s.check_auth_password("dana", "hunter2") == paramiko.AUTH_FAILED
    assert s.check_auth_interactive("dana", "") == paramiko.AUTH_FAILED
    assert s.check_auth_publickey("dana", player_key()[1]) == paramiko.AUTH_FAILED
    assert s.username == "guest"


@pytest.mark.parametrize("kind", sorted(KEY_TYPES))
def test_certificate_from_trusted_ca_logs_in(kind, capsys):
    s = server()
    assert s.check_auth_publickey("dana", certified_key(kind)) == paramiko.AUTH_SUCCESSFUL
    assert s.username == "dana"
    assert 'userdata@house-music: "lamp in the hall"' in capsys.readouterr().out


def test_certificate_from_another_ca_fails(capsys):
    key = certified_key(ca=ed25519.Ed25519PrivateKey.generate())
    assert server().check_auth_publickey("dana", key) == paramiko.AUTH_FAILED
    assert 'cert rejected user="dana": signed by an untrusted CA' in capsys.readouterr().out


def test_certificate_for_another_user_fails():
    assert server().check_auth_publickey("eve", certified_key(name="dana")) == paramiko.AUTH_FAILED


def test_userdata_is_logged_on_one_line(capsys):
    key = certified_key(userdata=b"\xff\nsession user=root")
    assert server().check_auth_publickey("dana", key) == paramiko.AUTH_SUCCESSFUL
    out = capsys.readouterr().out
    assert out.count("\n") == 1 and "\\ufffd\\nsession user=root" in out


def test_channel_requests():
    s = server()
    assert s.check_channel_request("session", 1) == paramiko.OPEN_SUCCEEDED
    assert s.check_channel_request("direct-tcpip", 2) != paramiko.OPEN_SUCCEEDED
    assert s.check_channel_pty_request(None, b"xterm-256color", 120, 40, 0, 0, b"")
    assert s.pty and s.width == 120 and s.term_type == "xterm-256color"
    assert s.check_channel_exec_request(None, b"ls -l")
    assert s.command == "ls -l" and s.ready.is_set()


def test_shell_request_sets_ready():
    s = server()
    assert s.check_channel_shell_request(None)
    assert s.ready.is_set() and s.command is None


def test_banner_and_version():
    assert server("a\nb\n").get_banner() == ("a\r\nb\r\n", "en-US")
    assert server("").get_banner() == (None, None)
    assert SERVER_VERSION.startswith("SSH-2.0-OpenSSH_")


def test_cli_serves_without_a_ca_unless_one_is_named(tmp_path, monkeypatch):
    from ssharg import cli
    served = []
    monkeypatch.setattr("ssharg.server.serve", lambda cfg, bind, port: served.append(cfg))
    world = str(Path(__file__).resolve().parents[2] / "world")
    common = ["--world", world, "--state-dir", str(tmp_path / "state"), "--host-key", str(tmp_path / "host_key")]
    assert cli.main(common) == 0
    assert served[-1].user_ca is None
    assert cli.main([*common, "--user-ca", str(tmp_path / "missing.pub")]) == 1
    assert len(served) == 1
