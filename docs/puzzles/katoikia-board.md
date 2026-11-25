# The KATOIKIA-7 board

KATOIKIA-7 is the NOMOS Control System at the Meridian Signal Laboratory, still online after the night operator vanished. Players dial in with `ssh`, log in under any name and land on the board’s menu. The board remembers each caller’s progress by name. The world files are in [bbs/world](../../bbs/world/).

## Finding the lantern

`C:\README.TXT` sends the caller to the logs and warns that changes need an authorization key. The incident report `C:\DOCS\INC0413.TXT` says the relay refuses every key unless a carrier is present, and that engineering thinks “lantern” was the operator’s name for that check.

Kade’s journal in `C:\USERS\KADE\JOURNAL.TXT` says the lantern was hidden “the way all the important things in a home directory are hidden”. `DIR /A` in Kade’s folder shows `.NOTES`, which holds `.LANTERN`. Reading it with `TYPE` lights the lantern and records the `lantern` flag.

## The handshake

The journal also holds a block marked `MERIDIAN NOTE`. Decoded from base64, it reads “when the lantern burns, say NORTHLIGHT to the relay”. Kade’s to-do list points at the key prompt on the board.

At the menu, **K** asks for an authorization key. The key has to be base64. Any key whose decoded text contains `NORTHLIGHT` reaches the relay. Without the lantern the relay answers “no carrier” and rejects it. With the lantern lit it opens a channel to something calling itself LANTERN and records the `northlight` flag. Later callers who repeat the key find the channel open and quiet.

Pasting the note’s own text works, because it decodes to a phrase containing the handshake.
