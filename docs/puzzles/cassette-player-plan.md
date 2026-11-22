# Cassette playback

*Implementation plan for [the cassette archive](cassette-archive.md).*

The first playable version is a case page on a second website. Press Play on the cassette and hear the house that came with the link. Any house can supply a tape before the downstairs computer exists.

## Open a tape

Build the case link with `houseLink(house, caseURL)`. On the archive page, `houseFromLink(location.href)` reads the snapshot from `#h=…`. Keep it in memory so visitors can listen without changing their saved houses. The bare address still opens the case. A damaged fragment leaves the case readable with a prompt to ask for a fresh link. [House format](../../web/library/house-format.js)

## Play both passes

Give the page its own entry point and ship the game’s instrument recordings with it. On Play, enable the sampler and run the house through the game’s transport. This preserves the arrangement’s tempo, the spaces between notes and the band’s reply on the second pass. Pause cancels scheduled notes. [Sampler](../../web/music/sampler.js) · [Transport](../../web/music/transport.js) · [Build](../../scripts/build.mjs)

## Play it through

Make a one-bar house with a late snare. Open its tape on a second local port in a fresh browser profile. Listen to both passes. The snare, the gaps and the band’s reply should match the house. Repeat with the band off to hear the furniture alone. [Score examples](../../test/music/house-band.test.js)

When the CRT arrives, double-clicking or double-tapping it opens the case in a new tab. Take the house from `transport.view().house` so a queued edit cannot change the tape before the player has heard it. Include the playing side when the house gains a B-side.
