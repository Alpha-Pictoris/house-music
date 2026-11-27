"""Terminal capability probes, sent once at the start of a session."""
from __future__ import annotations

import re
import time

from .terminal import Channel, ready_check

DA1_QUERY = b"\x1b[c"
# The ESC is optional: Windows Terminal 1.22-preview replied `[?61;4;...c` without it.
DA1_REPLY = re.compile(rb"\x1b?\[\?([\d;]*)c")
SIXEL_ATTRIBUTE = b"4"
POLL_INTERVAL = 0.005


def probe_sixel(channel: Channel, timeout: float = 0.5,
                typed: bytearray | None = None) -> bool | None:
    """Ask the terminal for its Primary Device Attributes. True if it lists sixel (attribute 4).

    None if no reply came within `timeout` seconds: no sixel, but the reply may still
    arrive, so the caller should drop a late `DA1_REPLY` from input. Bytes that are not
    part of the reply, such as keys the player typed meanwhile, are appended to `typed`
    so they are not lost. A channel without a readiness helper is never queried, because
    reading it could block, and gives False.
    """
    ready = ready_check(channel)
    if ready is None:
        return False
    try:
        channel.sendall(DA1_QUERY)
    except Exception:
        return False
    buffer = bytearray()
    found: re.Match[bytes] | None = None
    deadline = time.monotonic() + timeout
    while (left := deadline - time.monotonic()) > 0:
        try:
            if not ready():
                time.sleep(min(POLL_INTERVAL, left))
                continue
            data = channel.recv(1024)
        except Exception:
            break
        if not data:
            break
        buffer.extend(data)
        if found := DA1_REPLY.search(buffer):
            break
    if typed is not None:
        typed.extend(buffer[:found.start()] + buffer[found.end():] if found else buffer)
    if found is None:
        return None
    return SIXEL_ATTRIBUTE in found.group(1).split(b";")
