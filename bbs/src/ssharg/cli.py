"""Command-line entry point: load the world, then serve it over SSH or play it locally."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import TYPE_CHECKING

from .vfs import load_world
from .scripts import load_world_scripts
from .state import StateStore

if TYPE_CHECKING:
    import paramiko


def load_or_create_host_key(path: Path) -> "paramiko.PKey":
    import paramiko

    if path.exists():
        return paramiko.RSAKey.from_private_key_file(str(path))
    key = paramiko.RSAKey.generate(3072)
    path.parent.mkdir(parents=True, exist_ok=True)
    key.write_private_key_file(str(path))
    os.chmod(path, 0o600)
    print(f"generated host key {path}", flush=True)
    return key


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ssharg", description="Simulated BBS over SSH for ARGs.")
    p.add_argument("--local", action="store_true",
                   help="dial in from this terminal instead of starting the SSH server")
    p.add_argument("--bind", default="127.0.0.1", help="address to listen on (default 127.0.0.1)")
    p.add_argument("--port", type=int, default=2222, help="TCP port (default 2222)")
    p.add_argument("--world", default="world", help="world directory (default ./world)")
    p.add_argument("--state-dir", default="state", help="per-user progress directory (default ./state)")
    p.add_argument("--host-key", default="host_key", help="RSA host key file, created if missing")
    p.add_argument("--user-ca", default="user_ca.pub",
                   help="public key of the CA that signs player certificates (default user_ca.pub)")
    p.add_argument("--reset-user", metavar="NAME", help="clear NAME's saved progress and exit")
    p.add_argument("--list-users", action="store_true", help="print saved players and exit")
    return p


def list_users(store: StateStore) -> None:
    users = store.all_users()
    print(f"{'USER':<16} {'SESSIONS':>8} {'FLAGS':>5} {'KEYS':>4}  {'FIRST LOGIN':<25} LAST LOGIN")
    for u in users:
        print(f"{u.username:<16} {u.session_count:>8} {len(u.found_flags):>5} {len(u.keys):>4}  "
              f"{u.first_login:<25} {u.last_login}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    store = StateStore(args.state_dir)
    if args.list_users:
        list_users(store)
        return 0
    if args.reset_user:
        cleared = store.reset(args.reset_user)
        print(f"{'cleared' if cleared else 'no saved state for'} {args.reset_user}")
        return 0
    world = load_world(args.world)
    load_world_scripts(args.world)
    if args.local:
        from .local import run_local
        return run_local(world, store)
    from .certs import load_ca_public
    from .server import ServerConfig, serve
    user_ca = Path(args.user_ca)
    if not user_ca.exists():
        print(f"{user_ca} not found. Create the player CA with: ssharg-cert ca --out {user_ca.with_suffix('')}")
        return 1
    cfg = ServerConfig(world=world, store=store, host_key=load_or_create_host_key(Path(args.host_key)),
                       user_ca=load_ca_public(user_ca))
    serve(cfg, args.bind, args.port)
    return 0

