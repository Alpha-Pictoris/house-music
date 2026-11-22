# Loose shadows

*Implementation plan for [the B-side](b-side.md).*

Move a musical furnishing beside a lamp and a corner of its shadow curls off the floor. Drag the curl across the room. The furnishing stays put, and the sweep plays its phrase at the shadow. Drag it back to the furnishing’s feet to reattach it.

## Placement

Give the furnishing an optional `shadow` floor position with `x` and `z`. A loose shadow stays put when its furnishing moves within the room. Moving the furnishing to another room reattaches it. A duplicate starts with its own shadow at its feet.

Keep the curl visible until grabbed, even with reduced motion. Preview a mouse or touch drag in floor coordinates. One undo returns a dropped shadow to its last position. Cancelling or dropping into the missing corner of an L-shaped room keeps the old position. Use the same floor check for saves, files and links. [Scene](../../web/scene/house-scene.js) · [House editor](../../web/building/house-editor.js) · [House format](../../web/library/house-format.js)

## Sound

Use the shadow’s `x` to time the existing part in the score and its preview. The house band snaps that position to the nearest half beat. Objects on a shelf still play from their own spots. During playback, the edit takes effect when the loop comes around. [Score](../../web/music/score.js) · [Transport](../../web/music/transport.js)

## Play it through

Turn the band off. Give a wardrobe one guitar note and place a snare elsewhere. Pull the wardrobe’s shadow two beats to the right. The guitar should sound once, two beats later, with the snare on its original beat. Undo, redo, then reopen a share link and listen again. With the band on, its riff should follow the shadow too.
