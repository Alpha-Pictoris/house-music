"""World hooks for the Nomos Control Center.

The key handler judges keys entered at the BBS's [K] prompt. Each program runs when a player
types the name of its .EXE in C:\\BIN.
"""
import hashlib
import hmac

from ssharg.screens import render_text
from ssharg.scripts import key_handler, program

PASSWORD = "TOO MANY SECRETS"
KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
# Changing the salt changes every caller's key.
KEY_SALT = b"katoikia-7 nomos"

REBOOT_SEQUENCE = """
NOMOS REBOOT
{% call rate(0.5) %}
Saving room states ............... OK
Halting the sweep ................ OK
Flushing the note queue .......... OK
Loading the NOMOS kernel ......... OK
Restoring the rule table ......... {{ pause(1.0) }}PARTIAL
{% endcall %}

{% call typed(0.06) %}
NOMOS: system restarted. Rule table incomplete.
{% endcall %}
{{ pause(1.5) }}

TO BE CONTINUED...
"""


def auth_key(ctx) -> str:
    """The caller's 5-character key, from their address and BBS login name."""
    digest = hmac.new(KEY_SALT, f"{ctx.ip}|{ctx.username}".encode(), hashlib.sha256).digest()
    return "".join(KEY_ALPHABET[b % len(KEY_ALPHABET)] for b in digest[:5])


@program("ELEVATE")
def elevate(ctx, args: list[str]) -> None:
    out = ctx.term
    # Always prompt: a password typed on the command line would land in the session log.
    word = ctx.ask("PASSWORD: ", mask="*", record=False)
    if word is None:
        return
    if " ".join(word.upper().split()) != PASSWORD:
        out.line("ACCESS DENIED.")
        out.line("Kronos changed the secrets last. Look in C:\\USER\\KRONOS.")
        return
    ctx.grant_flag("elevated")
    out.line("ACCESS GRANTED. Administrator rights confirmed.")
    out.line()
    out.line(f"  AUTHORIZATION KEY: {auth_key(ctx)}")
    out.line()
    out.line("Type EXIT to leave the file area, choose [K] on the BBS menu")
    out.line("and enter this key.")


@key_handler
def check_key(ctx, key: str) -> bool:
    if key.upper() != auth_key(ctx):
        return False
    ctx.grant_flag("authorized")
    ctx.term.line(f"\nNOMOS: authorization key verified for {ctx.handle}.")
    ctx.term.line("NOMOS: reboot unlocked. Run C:\\BIN\\REBOOT.EXE in the file area.")
    return True


@program("REBOOT")
def reboot(ctx, args: list[str]) -> None:
    if not ctx.has_flag("authorized"):
        ctx.term.line("REBOOT FAILED: authorization key required.")
        ctx.term.line("Run ELEVATE, then enter the key at [K] on the BBS menu.")
        return
    ctx.grant_flag("rebooted")
    ctx.show_rendered(render_text(ctx.world.templates, REBOOT_SEQUENCE, ctx.screen_vars()))


@program("STATUS")
def status(ctx, args: list[str]) -> None:
    if ctx.has_flag("rebooted"):
        system, access = "RESTARTED, rule table incomplete", "AUTHORIZED"
    elif ctx.has_flag("authorized"):
        system, access = "DEGRADED", "AUTHORIZED, reboot unlocked"
    elif ctx.has_flag("elevated"):
        system, access = "DEGRADED", "ADMINISTRATOR, key issued"
    else:
        system, access = "DEGRADED", "GUEST"
    out = ctx.term
    out.line("NOMOS CONTROL CENTER STATUS")
    out.line(f"  System ........... {system}")
    out.line("  Sweep mode ....... left to right, one note per item")
    out.line(f"  Access ........... {access}")
    if access == "GUEST":
        out.line("Administrator rights are needed to reboot. See C:\\README.TXT.")
