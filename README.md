# House Music

Draw a house and play it as a track. A line sweeps across the floor. A wardrobe plays a distorted power chord, a standing mirror plays picked bass, and a lamp hits the drums. Leave a room empty for a rest.

## Play

1. Drag across the empty plot, or tap two opposite corners, to draw your first room.
2. Choose a piece of furniture to hear its instrument. Tap inside the room to place it.
3. Press **Play**. Move a piece one floor unit to the right to play it one beat later. Line up pieces at different depths to hear them together.
4. Select a wardrobe or mirror to pick a note in D minor. Set a lamp to kick, snare or closed hat. Draw another room along an existing wall and use **Door** to join them.

Goth metal plays at 128 BPM. Nightcore pitches the same performance up at 160 BPM. You can keep building during playback. Your changes join when the sweep starts its next pass.

Houses save to **Library** on this device. **Share** gives you a playable link or a house file. Open a friend's house, change the phrase and choose **Save a copy** to keep your remix.

### Keyboard

Focus the plot. Use the arrow keys to move the cursor or nudge a selected piece by a quarter beat along the floor. Hold Shift for a full unit. Enter sets a corner or places furniture, R rotates, Delete removes, and Space plays or pauses. Escape cancels a placement. Use the **Selection** list to reach individual rooms, doors and pieces.

## Run locally

With Python 3 installed, run this from the project directory.

```sh
python3 -m http.server 5173 --directory web
```

Open [House Music on this computer](http://localhost:5173/). To play from another device on the same network, use the computer’s LAN address and port 5173. The game also runs from any static host serving the contents of `web/`.

With Node.js 20 or later, run the tests with `npm test`.

The five instrument samples come from Frank Wen’s FluidR3 GM soundfont. [Sound credits and licence](web/credits.html)
