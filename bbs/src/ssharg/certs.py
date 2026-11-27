"""SSH user certificates: the only way into the BBS over SSH.

`ssharg-cert ca` creates the certificate authority the server trusts and
`ssharg-cert issue` signs a player's key with a userdata@house-music value.
The server calls `verify` on every certificate a client offers.
"""
from __future__ import annotations

import argparse
import os
import secrets
import sys
import time
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.serialization import (
    SSHCertificate,
    SSHCertificateBuilder,
    SSHCertificateType,
    SSHPublicKeyTypes,
)

USERDATA_EXTENSION = b"userdata@house-music"
CLOCK_SKEW = 300


class CertificateRejected(Exception):
    """The certificate does not let its holder log in; the message says why."""


def _openssh(key: SSHPublicKeyTypes) -> bytes:
    return key.public_bytes(serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH)


def verify(cert: SSHCertificate, ca: SSHPublicKeyTypes, username: str, now: float | None = None) -> bytes:
    """Return the certificate's userdata, or raise CertificateRejected."""
    now = time.time() if now is None else now
    if cert.type is not SSHCertificateType.USER:
        raise CertificateRejected("not a user certificate")
    if _openssh(cert.signature_key()) != _openssh(ca):
        raise CertificateRejected("signed by an untrusted CA")
    try:
        cert.verify_cert_signature()
    except InvalidSignature:
        raise CertificateRejected("bad CA signature") from None
    if not cert.valid_after <= now < cert.valid_before:
        raise CertificateRejected("outside its validity period")
    if username.encode() not in cert.valid_principals:
        raise CertificateRejected(f"not issued for user {username!r}")
    if cert.critical_options:
        # The server enforces none of them, and OpenSSH refuses certificates
        # whose critical options it cannot honour.
        raise CertificateRejected("carries critical options")
    userdata = cert.extensions.get(USERDATA_EXTENSION)
    if userdata is None:
        raise CertificateRejected("missing userdata@house-music")
    return userdata


def issue(
    ca: ed25519.Ed25519PrivateKey,
    public_key: SSHPublicKeyTypes,
    name: str,
    userdata: bytes,
    days: float,
    now: float | None = None,
) -> SSHCertificate:
    now = int(time.time() if now is None else now)
    return (
        SSHCertificateBuilder()
        .public_key(public_key)
        .serial(secrets.randbits(64))
        .type(SSHCertificateType.USER)
        .key_id(name.encode())
        .valid_principals([name.encode()])
        .valid_after(now - CLOCK_SKEW)
        .valid_before(now + int(days * 86400))
        .add_extension(USERDATA_EXTENSION, userdata)
        .sign(ca)
    )


def load_ca_public(path: Path) -> SSHPublicKeyTypes:
    return serialization.load_ssh_public_key(path.read_bytes())


def _write(path: Path, data: bytes, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode), "wb") as f:
        f.write(data)
    print(f"wrote {path}")


def _refuse_existing(*paths: Path) -> None:
    for path in paths:
        if path.exists():
            raise SystemExit(f"{path} already exists. Move it aside or choose another --out.")


def _cmd_ca(args: argparse.Namespace) -> None:
    private_path = Path(args.out)
    public_path = private_path.with_name(private_path.name + ".pub")
    _refuse_existing(private_path, public_path)
    key = ed25519.Ed25519PrivateKey.generate()
    _write(private_path, key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH, serialization.NoEncryption()
    ), 0o600)
    _write(public_path, _openssh(key.public_key()) + b" ssharg user CA\n")


def _cmd_issue(args: argparse.Namespace) -> None:
    ca_path = Path(args.ca)
    if not ca_path.exists():
        raise SystemExit(f"{ca_path} not found. Create the CA first with: ssharg-cert ca --out {ca_path}")
    ca = serialization.load_ssh_private_key(ca_path.read_bytes(), password=None)
    if not isinstance(ca, ed25519.Ed25519PrivateKey):
        raise SystemExit(f"{ca_path} is not an ed25519 key. Create one with: ssharg-cert ca")

    if args.key:
        public_path = Path(args.key)
        cert_path = public_path.with_name(public_path.name.removesuffix(".pub") + "-cert.pub")
        _refuse_existing(cert_path)
        public_key = serialization.load_ssh_public_key(public_path.read_bytes())
    else:
        private_path = Path(args.out or f"players/{args.name}")
        public_path = private_path.with_name(private_path.name + ".pub")
        cert_path = private_path.with_name(private_path.name + "-cert.pub")
        _refuse_existing(private_path, public_path, cert_path)
        private = ed25519.Ed25519PrivateKey.generate()
        public_key = private.public_key()
        _write(private_path, private.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH, serialization.NoEncryption()
        ), 0o600)
        _write(public_path, _openssh(public_key) + f" {args.name}\n".encode())

    cert = issue(ca, public_key, args.name, args.userdata.encode(), args.days)
    _write(cert_path, cert.public_bytes() + f" {args.name}\n".encode())
    identity = cert_path.with_name(cert_path.name.removesuffix("-cert.pub"))
    print(f"connect with: ssh -p 2222 -i {identity} {args.name}@HOST")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ssharg-cert", description="Create SSH certificates for ssharg players.")
    sub = p.add_subparsers(dest="command", required=True)

    ca = sub.add_parser("ca", help="create the certificate authority the server trusts")
    ca.add_argument("--out", default="user_ca", help="private key path; the .pub goes beside it (default user_ca)")
    ca.set_defaults(run=_cmd_ca)

    issue_ = sub.add_parser("issue", help="sign a player's key")
    issue_.add_argument("name", help="the SSH username the player must log in as")
    issue_.add_argument("--userdata", required=True, help="value of the userdata@house-music extension")
    issue_.add_argument("--ca", default="user_ca", help="CA private key (default user_ca)")
    issue_.add_argument("--days", type=float, default=30, help="days until it expires (default 30)")
    issue_.add_argument("--key", metavar="PUB", help="sign this existing public key instead of making a new one")
    issue_.add_argument("--out", help="where a new key pair goes (default players/NAME)")
    issue_.set_defaults(run=_cmd_issue)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "issue" and args.key and args.out:
        print("--out only applies to new key pairs. Drop it when using --key.", file=sys.stderr)
        return 2
    args.run(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
