# Cassette playback

## Run the archive

From the repository root, use Node.js 20.19 or later. The game also needs Python 3.

```sh
npm ci
npm run start:archive
```

The archive opens on [port 4174](http://localhost:4174/). Run `npm start` in a second terminal to open the game on port 5173. On another device, use the computer’s LAN address with the same ports.

## Text the number and take the ticket

Search for **EH/98/041** and lift the white label. The local archive writes a stand-in number on the blue one, from the range Ofcom keeps for drama, so a real text to it reaches nobody. Text it from a second terminal.

```sh
curl -d From=+447700900001 -d Body=hello http://localhost:4174/texts
```

The reply Twilio would send is inside `<Message>`. Search for the reference it gives, lift the label on the sleeve and take the ticket. The published archive writes the Record Office’s own number, or the one in `SMS_NUMBER`.

Tickets are signed with the board’s key in `bbs/user_ca` when that file exists, or with `BOARD_CA_KEY`. Otherwise the archive makes a throwaway key and prints the public line a local board should trust. Set `BOARD_HOST`, `BOARD_PORT` and `BOARD_USER` when building to change the address in the record’s notes, the captions and the ticket. [Local archive](../../scripts/serve-archive.mjs) · [Texting the video reference](video-reference.md)

## Bring a house to the case

Copy a share link from House Music. Append its `#h=` fragment to the archive homepage and search for **EH/98/041**. The cassette bears the house title and a short recording number calculated from the decoded house. The same saved version has the same number on another device. Press **Play tape** to hear the house using the game’s score, transport and recordings. The house stays in the browser. [Tape player](../../archive/player.js) · [House format](../../web/library/house-format.js)

To check the transfer by ear, make a one-bar house with a late snare. Listen to two passes in the house and on the cassette. The snare and the band’s reply should agree. With the house band off, the gaps between furnishings should agree too.

## Return to the game

The stairwell test strip carries its own house. In the local preview it opens on port 5173 on the same computer. Set `HOUSE_MUSIC_URL` when building the archive to open the strip in the hosted game. With that setting empty, visitors can download the house file. [Archive build](../../scripts/build-archive.mjs)

The monitor on the B-side opens the catalogue with the sounding house, so the tape matches what the player heard while an edit waits for the next loop. In the local preview the game on port 5173 opens the archive on port 4174. Set `ARCHIVE_URL` when building the game to open another address. [Monitor](../../web/ui/monitor.js) · [Game build](../../scripts/build.mjs)
