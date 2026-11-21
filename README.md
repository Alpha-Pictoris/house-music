# House Music

Draw a house and play it as a track. Build a bedroom around a harp-strung bed, hang a stained-glass window, or put thorn finials on the sofa and let it play guitar. A line sweeps through each room and plays the house you furnished.

## Make a house

1. Drag across the empty plot or tap two opposite corners to draw a room.
2. Choose the velvet sofa in **Furnish** and tap a spot on the floor. You'll hear a bar of its guitar riff with bass and drums. Press **Play** to loop it.
3. Try a dining set across the room. Its cut-glass fitting adds a celesta answering the guitar. Move it while paused to preview the new rhythm.

**House band** starts on. It rounds musical starts to the nearest half beat and fits the riffs to a sequence of D minor, B flat, F and C. The loop runs from the first musical bar to the last. Empty bars between them make space. Goth metal has a syncopated kick at 128 BPM. Nightcore pitches the instruments up and plays a four-on-the-floor beat at 160 BPM.

Add iron rings to play the bass line or brass studs to take over the drums. Thorn carvings play guitar, cut glass plays celesta, and silver strings play harp. Use **Fittings** to change a voice, pick a phrase, or leave a piece plain. Switch **House band** off to hear just your fittings at their exact floor positions. A unit along the sweep is one beat. Building edits join on the next pass.

Extend the house along a wall and use **Door** to join the rooms. Lay a rug under the dining set, fit a window, or plant a tree in the garden. Open **Style room** to name a room and change its finish. Walnut sounds warm and dry, moonstone adds a short echo, and moss carpet softens the notes.

Houses save to **Library** on this device. **Share** gives you a playable link or a house file. Change a friend's arrangement and choose **Save a copy** to keep your remix.

### Keyboard

Focus the plot. The arrows move the cursor or nudge a selected piece by a quarter unit. Hold Shift for a full unit. Enter sets a corner or places a piece, R turns furniture, Delete removes, Space plays or pauses, and Escape cancels a placement. Open the details tab beside **Furnish** for a list of selectable rooms, doors and pieces.

## Run locally

With Python 3 installed, run this from the project directory.

```sh
python3 -m http.server 5173 --directory web
```

Open [House Music on this computer](http://localhost:5173/). Other devices on the same network can use the computer’s LAN address and port 5173. Any static host can serve the contents of `web/`.

With Node.js 20 or later, run the tests with `npm test`.

The seven instrument samples come from Frank Wen’s FluidR3 GM soundfont. [Sound credits and licence](web/credits.html)
