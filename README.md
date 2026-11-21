# House Music

Draw a house and play it as a track. Build a bedroom around a harp-strung bed, hang a stained-glass window, or put thorn finials on the sofa and let it play guitar. A line sweeps through each room and plays the house you furnished.

## Make a house

1. Drag across the empty plot or tap two opposite corners to draw a room. Add rooms along existing walls and use **Door** to join them.
2. Open **Furnish**. Choose a piece, turn it if needed, then tap the floor. Lay a rug under the dining set, fit a window to an outside wall, or plant a tree in the garden.
3. Select a room and open **Style room** to name it and change its finish. Walnut sounds warm and dry, moonstone gives notes a short echo, and moss carpet softens them.
4. Select an indoor piece and open **Fittings**. A thorn carving plays guitar, iron rings play bass, brass studs play drums, cut glass plays celesta, and silver strings play harp. Plain pieces stay quiet. The fitting appears on the furniture.
5. Pick a phrase and press **Play**. One sofa can play a whole hook. Move it one floor unit to the right to start one beat later. Pieces at the same point along the sweep sound together.

Goth metal runs at 128 BPM. Nightcore raises the pitch and plays the same house at 160 BPM. Changes made during playback join on the next pass.

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
