# Cassette playback

## Run the archive

From the repository root, use Node.js 20.19 or later and Python 3.

```sh
npm ci
npm run start:archive
```

The archive opens on [port 4174](http://localhost:4174/). Run `npm start` in a second terminal to open the game on port 5173. On another device, use the computer’s LAN address with the same ports.

## Bring a house to the case

Copy a share link from House Music. Put everything from `#h=` onwards after `/cases/041/` on the archive origin. Press **Play tape**. The archive reads the house from the fragment and uses the same score, transport and recordings as the game. It keeps the house in memory while you listen. [Tape player](../../archive/player.js) · [House format](../../web/library/house-format.js)

To check the transfer by ear, make a one-bar house with a late snare. Listen to two passes in the house and on the cassette. The snare and the band’s reply should agree. With the house band off, the gaps between furnishings should agree too.

## Return to the game

The stairwell test strip carries its own house. In the local preview it opens on port 5173 on the same computer. For a separate deployment, set `HOUSE_MUSIC_URL` to the game’s full address when running `npm run build:archive`. Serve `dist-archive/` at the root of the archive host. A build without a configured game address offers the house file for download outside the local preview. [Archive build](../../scripts/build-archive.mjs)

The proposed B-side monitor should open the case with `houseLink(transport.view().house, caseURL)`. Taking the sounding house preserves what the player heard when an edit is waiting for the next loop.
