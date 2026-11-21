# House Music

Draw a house and play it as a track. Put thorn finials on a velvet sofa, hang a stained-glass window, and watch the sweep play the room. Three masked musicians march past the front door.

## Make a house

1. Drag across the empty plot or tap two opposite corners to draw a room.
2. Choose the velvet sofa in **Furnish** and tap the floor. In **Chrome Attic** its thorn carving plays a filter synth over bass and drums. Press **Play** to loop it.
3. Place a dining set across the room. Its cut glass adds a lead line. Move it while paused to preview the rhythm, or change **Arrangement** to hear the same room with a different band.

**House band** starts on. It fits the riffs to a shared set of chords and rounds musical starts to the nearest half beat. The loop runs from the first musical bar to the last. Empty bars between them make space. Switch the band off for exact floor timing and the marching trio walks away. Switch it on and they walk back.

Iron rings take the bass line. Brass studs take the drums. Use **Fittings** on any indoor piece to change its voice, pick a phrase, or leave it plain. A unit along the sweep is one beat. Building edits join on the next pass.

| Arrangement | Tempo | Sound |
| --- | ---: | --- |
| Chrome Attic | 128 BPM | A four-on-the-floor kick, octave synth bass and chords that open and close like a wah pedal. |
| Moth Mass | 176 BPM | Double kicks and galloping power chords under pipe organ and bowed strings. |
| Loose Floorboards | 108 BPM | Slap bass and clipped guitar land together, then leave a gap. |
| Bent Cassette | 84 BPM | Nylon guitar and electric piano over a lazy side stick and fretless bass. |
| Brass Landing | 160 BPM | Offbeat guitar chops, walking bass and short horn answers. |

Extend the house along a wall and use **Door** to join the rooms. Lay a rug under the dining set, fit a window, or plant a tree in the garden. Open **Style room** to name a room and change its finish. Walnut sounds warm and dry, moonstone adds a short echo, and moss carpet softens the notes.

Houses save to **Library** on this device. **Share** gives you a playable link or a house file. Change a friend's arrangement and choose **Save a copy** to keep your remix.

### Keyboard

Focus the plot. The arrows move the cursor or nudge a selected piece by a quarter unit. Hold Shift for a full unit. Enter sets a corner or places a piece, R turns furniture, Delete removes, Space plays or pauses, and Escape cancels a placement. Open the details tab beside **Furnish** for a list of selectable rooms, doors and pieces.

## Run locally

With Node.js 20 or later and Python 3 installed, run this from the project directory.

```sh
npm start
```

Open [House Music on this computer](http://localhost:5173/). Other devices on the same network can use the computer’s LAN address and port 5173. To publish, run `npm run build` and serve the contents of `dist/`. Each build gives its scripts, styles and recordings their own URLs.

With Node.js 20 or later, run the tests with `npm test`.

The instrument recordings use Frank Wen’s FluidR3 GM soundfont. [Sound credits and licence](web/credits.html)
