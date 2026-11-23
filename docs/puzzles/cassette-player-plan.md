# Cassette playback

## Run the archive

From the repository root, use Node.js 20.19 or later and Python 3.

```sh
npm ci
npm run start:archive
```

The archive opens on [port 4174](http://localhost:4174/). Run `npm start` in a second terminal to open the game on port 5173. On another device, use the computer’s LAN address with the same ports.

## Bring a house to the case

Copy a share link from House Music. Append its `#h=` fragment to the archive homepage and search for **EH/98/041**. The cassette bears the house title and a short recording number calculated from the decoded house. The same saved version has the same number on another device. Press **Play tape** to hear the house using the game’s score, transport and recordings. The house stays in the browser. [Tape player](../../archive/player.js) · [House format](../../web/library/house-format.js)

To check the transfer by ear, make a one-bar house with a late snare. Listen to two passes in the house and on the cassette. The snare and the band’s reply should agree. With the house band off, the gaps between furnishings should agree too.

## Return to the game

The stairwell test strip carries its own house. In the local preview it opens on port 5173 on the same computer. For a separate deployment, set `HOUSE_MUSIC_URL` to the game’s full address when running `npm run build:archive`. Serve `dist-archive/` at the root of the archive host. A build without a configured game address offers the house file for download outside the local preview. [Archive build](../../scripts/build-archive.mjs)

The proposed B-side monitor should display the file reference and open the catalogue with `houseLink(transport.view().house, archiveURL)`. Taking the sounding house preserves what the player heard when an edit is waiting for the next loop.
