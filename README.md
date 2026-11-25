# House Music

> [!NOTE]
> **Spoilers.** The design notes and walkthroughs in [docs/puzzles](docs/puzzles/) reveal the house’s secrets. Save them for after you play if you’d like to discover them yourself.

Draw a house and play it as a track. Put thorn finials on a velvet sofa, hang a stained-glass window, and watch the sweep play the room. Three masked musicians find their way between the furniture.

## Make a house

1. Drag across the empty plot or tap two opposite corners to draw a room.
2. Open **Furnish → Living**, drag the velvet sofa onto the floor, or tap the sofa and then the floor. In **Chrome Attic** its thorn carving plays a clipped clavinet over bass and drums. Press **Play** to loop it.
3. Place a dining set across the room. Its cut glass adds a lead line. Move it while paused to preview the rhythm, or choose a record in **Music** to hear the same room with a different band.

**House band** starts on. It fits the riffs to shared chords and rounds musical starts to the nearest half beat. The loop runs from the first musical bar to the last. The band plays its hook more softly under a furniture melody and leaves empty bars silent. Even a one-bar house gets a different answer on the next pass.

Press **Play** and the musicians head for different rooms, swaying as they walk. **Pause** leaves them standing where you stopped them. Switch House band off for exact floor timing. They walk out during playback and walk back when invited.

Iron rings on furniture take the bass line. Brass studs take the drums. Use **Fittings** to change a piece’s instrument, pick a phrase, or leave it plain. A unit along the sweep is one beat. Building edits join on the next pass.

| Arrangement | Tempo | Sound |
| --- | ---: | --- |
| Chrome Attic | 128 BPM | A kick on every beat, octave bass on the offbeats and a repeated two-note talking synth hook. |
| Moth Mass | 176 BPM | Low guitar and double kick gallop together. A pipe organ answers, followed by a held guitar harmony over a half-time snare. |
| Loose Floorboards | 108 BPM | Slap bass, low guitar punches and clipped group shouts give way to a half-time backbeat. |
| Bent Cassette | 84 BPM | A wordless vocal melody slides into a three-note hook over nylon guitar, fretless bass and a late side stick. |
| Brass Landing | 160 BPM | A harmonized brass call gets a low sax reply over clipped offbeat guitar and walking bass. |

With **Build → Draw room**, start inside a room and draw beyond a wall to add an alcove or another wing. Start on the outside wall to build a separate room and use **Doorway** to join them. Tap the floor and open **Style** to name a room and change its finish. Walnut sounds warm and dry, moonstone adds a short echo, and moss carpet softens the notes.

Open **Furnish → Tables & shelves**. Double-click or double-tap a table or shelf, choose a spot, then add a bottle, book, bell or pocket orrery. Tap **Move** and another spot to swap two objects. Objects start silent. Choose an **Instrument** and the object plays a short accent over the band as the sweep passes. Moving or turning the furniture carries its objects with it.

Select a bookcase to read the mark on its spine. In some rooms the writing changes. You can fold the note and read it again from the plot.

Tap the curved arrow to turn a piece a quarter turn before or after placing it. **Camera** holds **Pan**, **Orbit** and zoom. Two fingers drag or pinch the map in any tool. On a mouse, drag with the middle button to pan and scroll to zoom.

Tap the house name to open your library. Houses save on this device. **Share** gives you a playable link or a house file. Choose **Save a copy** to keep your own version of a shared house.

### Keyboard

Focus the plot. The arrow keys move the cursor or nudge a selected piece by a quarter unit. Hold Shift for a full unit. In **Pan**, the arrows move the view. Comma turns furniture left, period or R turns it right. Enter sets a corner or places a piece, Delete removes, Space plays or pauses, and Escape cancels a placement. The bracket keys cycle through rooms, doors and furniture.

## Run locally

With Node.js 20 or later and Python 3 installed, run this from the project directory.

```sh
npm start
```

Open [House Music on this computer](http://localhost:5173/). Other devices on the same network can use the computer’s LAN address and port 5173.

With Node.js 20 or later, run the tests with `npm test`.

The instrument recordings use Frank Wen’s FluidR3 GM soundfont. [Sound credits and licence](web/credits.html)

## Dial in to the board

The KATOIKIA-7 board is an old bulletin board that players reach with `ssh`. It lives in [bbs](bbs/). With Python 3.10 or later and [uv](https://docs.astral.sh/uv/) installed, run this from the `bbs` directory.

```sh
uv run ssharg --local
```

[Running the board over SSH](bbs/README.md)

## Publish

Merging to `trunk` publishes the game to GitHub Pages and the archive to Cloudflare. To host the game elsewhere, run `npm run build` and serve the contents of `dist/`.
