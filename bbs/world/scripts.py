"""World hooks for the shipped world.

The authorization-key handler receives the base64-decoded bytes of whatever key a player
enters at the BBS's [K] prompt and returns True to accept it or False to reject it.
"""
from ssharg.scripts import key_handler

HANDSHAKE = "NORTHLIGHT"


@key_handler
def check_key(ctx, payload: bytes) -> bool:
    text = payload.decode("utf-8", "replace")
    if HANDSHAKE not in text.upper():
        return False
    out = ctx.term
    if not ctx.has_flag("lantern"):
        out.line("\nRELAY: handshake refused: no carrier. (lantern absent)")
        return False
    if ctx.has_flag("northlight"):
        out.line("\nRELAY: channel already open. The other side is quiet. For now.")
        return True
    out.line("\nRELAY: carrier present. handshake accepted.")
    out.line("RELAY: channel open. remote identifies as: LANTERN")
    out.line("")
    out.line("    > you found the light kade left on.")
    out.line("    > they are not gone. they are on the other side of the relay.")
    out.line("    > keep it burning. we will call again.")
    ctx.grant_flag("northlight")
    return True
