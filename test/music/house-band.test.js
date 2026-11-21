import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { Score } from "../../web/music/score.js";
import { houseFromLink, houseLink } from "../../web/library/house-format.js";

function room(width = 8) {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: width, z: 6 });
  return editor;
}

test("one wardrobe gets a four-beat riff, bass and drums wherever it is placed", () => {
  const editor = room(20);
  const piece = editor.place("wardrobe", { x: 10.24, z: 2 });
  const score = Score.from(editor.house);
  assert.deepEqual([score.left, score.beats], [8, 4]);
  assert.equal(editor.house.pieces[0].x, 10.24);
  assert.ok(score.events.filter(n => n.pieceId === piece.id).length >= 3);
  assert.ok(score.events.some(n => n.pieceId === piece.id && n.beat === 2));
  assert.deepEqual(new Set(score.events.map(n => n.sample)), new Set(["guitar", "bass", "kick", "hat", "snare"]));
});

test("furnished bars follow the chords and leave a full empty bar quiet", () => {
  const editor = room(12);
  const left = editor.place("table", { x: 0, z: 0 });
  const right = editor.place("table", { x: 8, z: 0 });
  editor.setPhrase(left.id, "single");
  editor.setPhrase(right.id, "single");
  const { events } = Score.from(editor.house);
  assert.ok(!events.some(n => n.beat >= 4 && n.beat < 8));
  assert.deepEqual([left, right].map(p => events.find(n => n.pieceId === p.id).semitones), [0, 3]);
});

test("a bass fitting takes the bass line and a second drum fitting shares the kit", () => {
  const editor = room(4);
  const bass = editor.place("mirror", { x: 0, z: 3 });
  editor.place("lamp", { x: 0, z: 0 });
  editor.place("lamp", { x: 1, z: 1 }, "snare");
  const { events } = Score.from(editor.house);
  assert.ok(events.filter(n => n.sample === "bass").every(n => n.pieceId === bass.id));
  const drums = events.filter(n => ["kick", "snare", "hat"].includes(n.sample));
  assert.equal(new Set(drums.map(n => [n.sample, n.beat].join("/"))).size, drums.length);
  assert.ok(new Set(drums.map(n => n.velocity)).size > 1);
});

test("goth metal has a syncopated kick and Nightcore has four on the floor", () => {
  const editor = room(4);
  editor.place("bed", { x: 0, z: 0 });
  const kicks = () => Score.from(editor.house).events.filter(n => n.sample === "kick").map(n => n.beat);
  const goth = kicks();
  editor.setMode("nightcore");
  assert.deepEqual(kicks(), [0, 1, 2, 3]);
  assert.ok(goth.includes(1.5));
});

test("turning the band off preserves the exact solo performance in a shared house", () => {
  const editor = room(8);
  editor.place("wardrobe", { x: 2.27, z: 2 });
  editor.setBand(false);
  const loaded = houseFromLink(houseLink(editor.house, "https://example.com/"));
  assert.deepEqual(Score.from(loaded).events.map(n => [n.beat, n.sample]), [[2.27, "guitar"]]);
  editor.undo();
  assert.ok(Score.from(editor.house).events.some(n => n.sample === "kick"));
});

test("stacked unisons share one attack and both pieces respond", () => {
  const editor = room(4);
  const a = editor.place("wardrobe", { x: 0.1, z: 0 });
  const b = editor.place("sofa", { x: 0.21, z: 3 });
  const attacks = Score.from(editor.house).events.filter(n => n.sample === "guitar" && n.beat === 0);
  assert.equal(attacks.length, 1);
  assert.deepEqual(new Set(attacks[0].together), new Set([a.id, b.id]));
});

test("a placed piece previews its actual bar and a catalogue piece auditions alone", () => {
  const editor = room(8);
  const sofa = editor.place("sofa", { x: 1.1, z: 1 });
  editor.place("lamp", { x: 5, z: 1 });
  const score = Score.from(editor.house);
  const bar = score.events.filter(note => note.beat < 4);
  const heard = score.preview(sofa);
  assert.deepEqual(heard.map(n => n.offset).sort((a, b) => a - b), bar.map(n => (n.beat + 3) % 4).sort((a, b) => a - b));
  assert.ok(heard.some(note => note.pieceId === sofa.id && note.offset === 0));
  assert.deepEqual(new Set(score.preview({ kind: "sofa", pitch: 50 }).map(n => n.sample)), new Set(["guitar"]));
});

test("returning to the house riff clears the manual phrase and survives a save", () => {
  const editor = room(4);
  const sofa = editor.place("sofa", { x: 0, z: 0 });
  editor.setPhrase(sofa.id, "single");
  assert.equal(Score.from(editor.house).events.filter(n => n.pieceId === sofa.id).length, 1);
  editor.setPhrase(sofa.id, null);
  const copy = houseFromLink(houseLink(editor.house, "https://example.com/"));
  assert.ok(!Object.hasOwn(copy.pieces[0], "phrase"));
  assert.ok(Score.from(copy).events.filter(n => n.pieceId === sofa.id).length > 1);
});
