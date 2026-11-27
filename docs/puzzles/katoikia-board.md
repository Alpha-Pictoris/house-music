# The KATOIKIA-7 board

KATOIKIA-7 is a house run by NOMOS, the control system behind the house’s music. NOMOS has failed to start, so the house falls back to a plain sweep: it plays the rooms from left to right, one note per item. Players dial in with `ssh`, log in under any name and land on the Nomos Control Center menu. The board remembers each caller’s progress by name. The world files are in [bbs/world](../../bbs/world/).

## Kronos’s password

At **F**, the file area opens at `C:\`. `C:\README.TXT` says NOMOS must be rebooted, that the reboot needs an authorization key, and that Kronos, a forgetful administrator, was the last to change the secrets. It points to user data in `USER` and programs in `BIN`.

`C:\USER\KRONOS\SECRETS.TXT` holds `SETEC ASTRONOMY`, signed “scrambled, so it is safe to write down”. `FIND.ME` in the same folder is Kronos’s note to himself, full of 80s hacker-film lines (“the backdoor is not JOSHUA”, “my voice is not my passport”). It says the password is the same letters in a different order, to be unscrambled “the way the Sneakers crew did: letter tiles on a table”. On a terminal that draws sixel images, the note shows a pixel-art sneaker; elsewhere it describes one. In *Sneakers*, the letters of SETEC ASTRONOMY unscramble to **TOO MANY SECRETS**.

## The key

`ELEVATE` (in `C:\BIN`, runnable from anywhere) asks for a password. A wrong one is refused with a pointer back to Kronos’s folder. `TOO MANY SECRETS`, in any case and spacing, prints a 5-character authorization key and tells the player to exit the file area and enter it at the menu. The key is made from the caller’s IP address and BBS login name, so callers can’t share keys. Behind Docker’s port mapping every caller may share one address; the name still keeps keys apart.

At **K**, the player enters the key. The board accepts it in any case and unlocks the reboot. A wrong key shows where to get one.

## The reboot

`STATUS` reports NOMOS as degraded, the sweep mode and the caller’s access. `REBOOT` refuses to run without an accepted key. After one, it plays the reboot sequence. NOMOS restarts with an incomplete rule table, and the board shows **TO BE CONTINUED...** The menu then reports NOMOS as restarted.

The board records three flags: `elevated`, `authorized` and `rebooted`.
