# The KATOIKIA-7 board

> **Placeholder text.** The NOMOS story below, and the world files it describes, stand in until the board’s real narrative is written.

KATOIKIA-7 is a house run by NOMOS, a control system that sets the rules every room follows. NOMOS has lost its rule table and locked the house. Players dial in with `ssh`, log in under any name and land on the board’s menu. The board remembers each caller’s progress by name. The world files are in [bbs/world](../../bbs/world/).

## Finding the override

`C:\README.TXT` sends the caller to the logs and warns that restoring NOMOS needs an authorization key. The incident report `C:\DOCS\INC0413.TXT` says NOMOS refuses every key unless a maintenance override is engaged, and that the operator prepared one before the failure. `C:\LOGS\SYSLOG.TXT` shows the override was written to `C:\USERS\KADE\.NOTES`.

Kade’s journal in `C:\USERS\KADE\JOURNAL.TXT` says the override was hidden “the way all the important things in a home directory are hidden”. `DIR /A` in Kade’s folder shows `.NOTES`, which holds `.OVERRIDE`. Reading it with `TYPE` engages the override and records the `override` flag.

`SCANNER.ANS` sits in the same folder as a working prop, not a clue. `PLAY SCANNER.ANS` shows a signal-scan animation that redraws until the player presses a key.

## The restore word

The journal also holds a block marked `NOMOS NOTE`. Decoded from base64, it reads “with the override engaged, give NOMOS the word KEYSTONE”. Kade’s to-do list points at the key prompt on the board.

At the menu, **K** asks for an authorization key. The key has to be base64. Any key whose decoded text contains `KEYSTONE` reaches NOMOS. Without the override NOMOS refuses it. With the override engaged NOMOS restores its rule table, unlocks the rooms and records the `keystone` flag. Later callers who repeat the key find the house already restored.

Pasting the note’s own text works, because it decodes to a phrase containing the restore word.
