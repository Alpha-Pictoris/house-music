"""World hooks for the shipped world.

The authorization-key handler receives the base64-decoded bytes of whatever key a player
enters at the BBS's [K] prompt and returns True to accept it or False to reject it.
"""
from ssharg.scripts import key_handler

# PLACEHOLDER TEXT: the restore word and NOMOS replies below are stand-ins.
RESTORE_WORD = "KEYSTONE"


@key_handler
def check_key(ctx, payload: bytes) -> bool:
    text = payload.decode("utf-8", "replace")
    if RESTORE_WORD not in text.upper():
        return False
    out = ctx.term
    if not ctx.has_flag("override"):
        out.line("\nNOMOS: key refused. maintenance override not engaged.")
        return False
    if ctx.has_flag("keystone"):
        out.line("\nNOMOS: rule table already restored. All rooms open.")
        return True
    out.line("\nNOMOS: override engaged. restore word accepted.")
    out.line("NOMOS: rule table restored from backup.")
    out.line("NOMOS: unlocking rooms.")
    ctx.grant_flag("keystone")
    return True
