# ssharg

A small server that pretends to be an old bulletin board system that's still
online, for alternate reality games. Players dial in with an ordinary `ssh`
client (or locally from a terminal), log in, watch it boot, and land on the
BBS menu. From there they can enter an authorization key or browse a
read-only file area with a DOS-style prompt.

Nothing a player types is ever executed on the host, and the host's real
filesystem is never exposed: the whole world is loaded into memory from the
`world/` directory at startup. The game master changes the game by editing
files under `world/`, not engine code. The one exception is the
authorization-key handler, a few lines of Python in `world/scripts.py`.

## Running it

Requires Python 3.10+ and [uv](https://docs.astral.sh/uv/).

```sh
uv sync                       # create .venv and install deps from uv.lock
uv run ssharg --port 2222     # or: uv run python -m ssharg
```

Then, from anywhere:

```sh
ssh -p 2222 anyname@127.0.0.1
```

Or dial in from your own terminal with no SSH involved:

```sh
uv run ssharg --local
```

The SSH username is ignored and no SSH password is needed. Players log in
to the BBS itself: any name and any password are accepted, and progress is
saved per name (`Dark Wren` is stored as `dark_wren`). `ssh host command`
is refused because the BBS needs an interactive terminal. Piped input
(`ssh -T`, or `uv run ssharg --local < script.txt`) works line by line.

Options:

| flag | default | meaning |
| --- | --- | --- |
| `--local` | | dial in from this terminal instead of serving SSH |
| `--bind` | `127.0.0.1` | listen address (use `0.0.0.0` to expose it) |
| `--port` | `2222` | TCP port |
| `--world` | `world` | world directory |
| `--state-dir` | `state` | where per-player progress JSON lives |
| `--host-key` | `host_key` | RSA host key; generated on first run |
| `--list-users` | | print saved players and exit |
| `--reset-user NAME` | | delete NAME's progress and exit |

Each finished SSH session logs one line to stdout:

```
session user=wren src=127.0.0.1:60882 history=["F", "dir", "exit", "K", "Tk9S...", "G"]
```

Run the tests with `uv run pytest`. They open no sockets.

## The session

1. **Login.** The `login` screen, then `USER NAME:` and `PASSWORD:` (masked
   with `*`). Three blank names and the line drops.
2. **Boot.** The `boot` screen, typed out line by line (`boot_delay` seconds
   per line).
3. **Main menu.** The `menu` screen and a `SELECTION:` prompt:
   - `K`: enter an authorization key.
   - `F`: the file area (DOS prompt). `EXIT` comes back to the menu.
   - `G` (or `Q`): the `goodbye` screen, then hang up.

### Authorization keys

The player pastes a key at `AUTHORIZATION KEY:`. The key must be base64
(standard or URL-safe, padding optional, whitespace ignored). Anything else
is rejected without being saved. A valid key's decoded bytes go to the
world's key handler, which returns True to accept it or False to reject it.
Every valid key a player submits is saved in their progress file with a
timestamp and the verdict. With no handler registered, any valid base64 key
is accepted.

```python
from ssharg.scripts import key_handler

@key_handler
def check_key(ctx, payload: bytes) -> bool:
    if payload != b"expected":
        return False
    ctx.term.line("TRANSMISSION RECEIVED.")
    ctx.grant_flag("transmission")
    return True
```

The handler can print with `ctx.term.line()`, check and record progress with
`ctx.has_flag()` and `ctx.grant_flag()`, and see `ctx.username` (the stored
name) and `ctx.handle` (the name as typed). The engine shows the
`key_accepted` or `key_rejected` screen after it returns. If the handler
raises, the key counts as rejected.

### The file area

A read-only DOS-style prompt (`C:\USERS\KADE>`) over the world tree:

| command | does |
| --- | --- |
| `DIR [path] [/A]` (or `LS`, `ls -a`) | list a directory; `/A` includes hidden files |
| `CD [path]` (or `CHDIR`) | change directory; `CD ..`, `CD..`, `CD \` work |
| `TYPE file` | print a file |
| `CLS` | clear the screen |
| `VER` | print `dos_version` from `meta.json` |
| `HELP` | list commands |
| `EXIT` | back to the BBS menu |

Paths use `\` and may start with `C:`. Names are case-insensitive and shown
in upper case. Anything else gets `Bad command or file name`.

## Code layout

```
src/ssharg/
  cli.py            argparse entry point (`ssharg` script, `python -m ssharg`)
  bbs.py            the session: login, boot, menu, authorization keys
  dos.py            the file-area prompt and its commands
  context.py        per-session context shared by the BBS, DOS and world hooks
  terminal.py       transport-agnostic terminal output and line reader
  scripts.py        world hook registry (`key_handler`)
  state.py          per-player progress persisted as JSON
  local.py          local-terminal front end (`--local`)
  server/host.py    SSH front end: Paramiko auth and channel dispatch
  vfs/filesystem.py in-memory, read-only, case-insensitive world filesystem
tests/              pytest suite
```

`bbs.run_session()` takes any byte channel, so the SSH server, the local
terminal and the tests all run the same session code.

## How the world is laid out

```
world/
  banner.txt      shown by the ssh client before connecting (and by --local)
  meta.json       BBS name, volume label, DOS version, file dates, flags
  screens/        BBS screens (see below)
  scripts.py      the authorization-key handler
  root/           the file area; root/ is C:\
```

`meta.json` keys:

| key | meaning |
| --- | --- |
| `name` | BBS name, available to screens as `{{ meta.name }}` / `{{ bbs }}` and the server log |
| `volume` | volume label shown by `DIR` (default: `name`) |
| `dos_version` | text printed by `VER` |
| `epoch` | Unix time shown as every file's date |
| `boot_delay` | default seconds per line for the boot screen (default 0.05; other screens default to 0) |
| `flags` | flag names and descriptions, for the game master's reference |
| `node_flags` | files that record a flag when read with `TYPE` |

### Screens

Each screen is `screens/NAME.txt` (UTF-8, ANSI colour escapes allowed) or
`screens/NAME.ans` (classic CP437 ANSI art, converted to UTF-8 on load).
Missing screens fall back to plain built-in defaults.

| screen | shown |
| --- | --- |
| `login` | before the user name prompt |
| `boot` | after login, typed out line by line |
| `menu` | each time the main menu comes up |
| `dos` | on entering the file area |
| `key_accepted` / `key_rejected` | after a key is judged |
| `goodbye` | on logoff |

Screens are [Jinja2](https://jinja.palletsprojects.com/) templates. They can
use `{{ bbs }}`, `{{ user }}` (the name as typed), `{{ calls }}` (this player's
call count, including this one), `{{ last_login }}` (`never` on a first call),
`{{ nomos_state }}`, `{{ meta }}` (all of `meta.json`) and `{{ ctx }}` (the
session context, e.g. `{{ ctx.has_flag("lantern") }}`). Conditionals, loops,
filters and `{% include "other_screen" %}` all work. To pad a value inside a
box, use `{{ value.ljust(28) }}`. Rendering is strict: a misspelled or unknown
variable raises an error instead of printing nothing. Screens shown before login (`boot`,
`login`) see `GUEST` as the user and 0 calls.

#### Timing

Any screen can pace itself:

| in the screen | effect |
| --- | --- |
| `{{ pause(1.5) }}` | wait 1.5 s at that point, even partway through a line |
| `{% call rate(0.4) %}…{% endcall %}` | wait 0.4 s after each line inside the block |
| `{% call typed(0.03) %}…{% endcall %}` | type the block out 0.03 s per character |

Blocks nest, and the outer speed comes back when a block ends. A line holding
only `pause` calls prints nothing. Outside any `rate` block, lines use
`boot_delay` on the boot screen and no delay elsewhere. Timing only happens on
a real terminal; piped sessions and tests get the whole screen at once.

```
Memory test ......................{{ pause(1.2) }} 640K OK
{% call typed(0.02) %}
Modem on COM1 .................... 2400 baud, carrier present
{% endcall %}
```

### Add a file

Drop it into `world/root/` at the path you want and restart the server.
Upper-case names look most authentic. Names starting with `.` are hidden
from `DIR` unless `/A` is given. Files named `.gitkeep` are skipped, so empty
directories can be committed. Symlinks are skipped, never followed.

### Add a flag

Flags are names that record progress. Either attach one to a file, so
reading the file with `TYPE` records it:

```json
"node_flags": {"/USERS/KADE/.NOTES/.LANTERN": ["lantern"]}
```

or grant it from the key handler with `ctx.grant_flag("name")`. Players
never see flags. Check progress with `--list-users` or in `state/*.json`.

## The shipped world

The KATOIKIA-7 NOMOS Control System, a Meridian Signal Laboratory board left
online after an incident. Start in `C:\USERS\KADE`. There are two flags: one
is a hidden file, and the other comes from entering a key that the hidden file
makes work. The walkthrough is in
[The KATOIKIA-7 board](../docs/puzzles/katoikia-board.md).

## Deliberate limitations

- Nothing can be changed. There are no commands that write, copy, move or
  delete, and the filesystem has no write operations.
- No wildcards, pipes or redirects. `DIR *.TXT` looks for a file literally
  named `*.TXT`.
- Line editing covers typing, Backspace, Ctrl-C and Ctrl-D only. Arrow keys
  are ignored, and there is no command history recall.
- `TYPE` prints the whole file. There is no pager (`MORE`).
- The world loads once at startup. Restart to pick up edits.
- Login has no real accounts. Anyone can log in as any name and continue
  that name's progress.
