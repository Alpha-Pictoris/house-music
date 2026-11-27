import paramiko
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import (
    SSHCertificateBuilder,
    SSHCertificateType,
    load_ssh_public_identity,
)

from ssharg.certs import USERDATA_EXTENSION, CertificateRejected, issue, load_ca_public, main, verify
from ssharg.server import ArgServer

NOW = 1_800_000_000
CA = ed25519.Ed25519PrivateKey.generate()
PLAYER = ed25519.Ed25519PrivateKey.generate().public_key()


def builder(**overrides):
    fields = dict(
        type=SSHCertificateType.USER, principals=[b"wren"], after=NOW - 60, before=NOW + 60,
        extensions={USERDATA_EXTENSION: b"lamp"}, critical={},
    )
    fields.update(overrides)
    b = (
        SSHCertificateBuilder()
        .public_key(PLAYER)
        .type(fields["type"])
        .valid_after(fields["after"])
        .valid_before(fields["before"])
    )
    b = b.valid_for_all_principals() if fields["principals"] is None else b.valid_principals(fields["principals"])
    for name, value in fields["extensions"].items():
        b = b.add_extension(name, value)
    for name, value in fields["critical"].items():
        b = b.add_critical_option(name, value)
    return b.sign(CA)


def test_issued_certificate_verifies():
    cert = issue(CA, PLAYER, "wren", b"lamp", days=1, now=NOW)
    assert verify(cert, CA.public_key(), "wren", now=NOW) == b"lamp"
    assert cert.valid_principals == [b"wren"] and cert.key_id == b"wren"


@pytest.mark.parametrize("cert, username, now, reason", [
    (lambda: builder(), "wren", NOW + 60, "outside its validity period"),
    (lambda: builder(), "wren", NOW - 61, "outside its validity period"),
    (lambda: builder(), "dana", NOW, "not issued for user 'dana'"),
    (lambda: builder(principals=None), "wren", NOW, "not issued for user 'wren'"),
    (lambda: builder(type=SSHCertificateType.HOST), "wren", NOW, "not a user certificate"),
    (lambda: builder(extensions={}), "wren", NOW, "missing userdata@house-music"),
    (lambda: builder(critical={b"force-command": b"sh"}), "wren", NOW, "carries critical options"),
])
def test_rejections(cert, username, now, reason):
    with pytest.raises(CertificateRejected, match=reason):
        verify(cert(), CA.public_key(), username, now=now)


def test_untrusted_ca_is_rejected():
    with pytest.raises(CertificateRejected, match="untrusted CA"):
        verify(builder(), ed25519.Ed25519PrivateKey.generate().public_key(), "wren", now=NOW)


def test_tampered_signature_is_rejected():
    blob = bytearray(builder().public_bytes())
    # Flip a bit in the base64 of the trailing CA signature.
    blob[-4] = ord("A") if blob[-4] != ord("A") else ord("B")
    with pytest.raises(CertificateRejected, match="bad CA signature"):
        verify(load_ssh_public_identity(bytes(blob)), CA.public_key(), "wren", now=NOW)


def test_command_line_issues_a_working_login(tmp_path, capsys):
    ca = tmp_path / "user_ca"
    assert main(["ca", "--out", str(ca)]) == 0
    assert (ca.stat().st_mode & 0o777) == 0o600
    out = tmp_path / "players" / "wren"
    assert main(["issue", "wren", "--ca", str(ca), "--userdata", "lamp in the hall", "--out", str(out)]) == 0
    assert "connect with: ssh -p 2222 -i" in capsys.readouterr().out

    key = paramiko.Ed25519Key.from_private_key_file(str(out))
    key.load_certificate(str(out) + "-cert.pub")
    s = ArgServer(load_ca_public(tmp_path / "user_ca.pub"))
    assert s.check_auth_publickey("wren", key) == paramiko.AUTH_SUCCESSFUL
    assert s.check_auth_publickey("dana", key) == paramiko.AUTH_FAILED


def test_command_line_signs_an_existing_key(tmp_path):
    main(["ca", "--out", str(tmp_path / "user_ca")])
    pub = tmp_path / "id_ed25519.pub"
    pub.write_bytes(PLAYER.public_bytes(serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH))
    main(["issue", "wren", "--ca", str(tmp_path / "user_ca"), "--userdata", "lamp", "--key", str(pub)])
    cert = load_ssh_public_identity((tmp_path / "id_ed25519-cert.pub").read_bytes())
    assert verify(cert, load_ca_public(tmp_path / "user_ca.pub"), "wren") == b"lamp"


def test_command_line_never_overwrites(tmp_path):
    main(["ca", "--out", str(tmp_path / "user_ca")])
    with pytest.raises(SystemExit, match="already exists"):
        main(["ca", "--out", str(tmp_path / "user_ca")])


def test_command_line_explains_a_missing_ca(tmp_path):
    with pytest.raises(SystemExit, match="Create the CA first"):
        main(["issue", "wren", "--ca", str(tmp_path / "nope"), "--userdata", "x"])
