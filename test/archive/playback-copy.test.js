import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { testStripURL } from "../../scripts/archive-return.mjs";
import { houseFromLink, readHouse } from "../../web/library/house-format.js";
import { Score } from "../../web/music/score.js";

test("the enclosed strip repeats the descent with a late bass reply", async () => {
  const destination = new URL(testStripURL("https://music.example/houses/"));
  const house = houseFromLink(destination);
  assert.equal(destination.origin + destination.pathname, "https://music.example/houses/");
  const attachment = new URL(testStripURL(""), "https://archive.example/");
  const file = new URL("../../archive" + attachment.pathname, import.meta.url);
  assert.deepEqual(readHouse(JSON.parse(await readFile(file, "utf8"))), house);
  assert.deepEqual(houseFromLink(attachment), house);

  const score = Score.from(house);
  assert.equal(score.beats, 8);
  assert.deepEqual(score.events.filter(note => note.sample === "harp").map(note => [note.beat, note.semitones]),
    [[0, 7], [0.75, 3], [1, 0], [4, 7], [4.75, 3], [5, 0]]);
  assert.deepEqual(score.events.filter(note => note.sample === "bass").map(note => note.beat), [2.5, 7]);
});
