import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { Score } from "../../web/music/score.js";

test("bare ground and an empty room are silent", () => {
  const editor = new HouseEditor();
  assert.deepEqual(Score.from(editor.house).events, []);
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  assert.deepEqual(Score.from(editor.house).events, []);
});

test("moving the wardrobe shifts only the guitar", () => {
  const editor = new HouseEditor();
  editor.setBand(false);
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const guitar = editor.place("wardrobe", { x: 2, z: 0 });
  editor.place("mirror", { x: 2, z: 3 });
  editor.move(guitar.id, { x: 3, z: 0 });
  editor.rotate(guitar.id);
  assert.deepEqual(Score.from(editor.house).events.map(e => [e.sample, e.beat]), [["bass", 2], ["guitar", 3]]);
});

test("a room to the left adds whole bars", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: -3, z: 0 }, { x: 8, z: 6 });
  const { left, beats } = Score.from(editor.house);
  assert.deepEqual([left, beats], [-4, 12]);
});

test("a decimal room ending on a bar line adds no extra bar", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: -7.999, z: 0 }, { x: 4, z: 4 });
  const { left, beats } = Score.from(editor.house);
  assert.deepEqual([left, beats], [-8, 12]);
});

test("the same fitting plays the same phrase on a bed and a sofa", () => {
  const editor = new HouseEditor();
  editor.setBand(false);
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const bed = editor.place("bed", { x: 0, z: 0 });
  const sofa = editor.place("sofa", { x: 0, z: 3 });
  for (const piece of [bed, sofa]) {
    editor.fitPiece(piece.id, "thorn");
    editor.setPhrase(piece.id, "rise");
  }
  const { events } = Score.from(editor.house);
  for (const id of [bed.id, sofa.id]) {
    assert.deepEqual(events.filter(note => note.pieceId === id).map(note => [note.sample, note.beat, note.semitones]), [
      ["guitar", 0, 0], ["guitar", 0.5, 3], ["guitar", 1, 7]
    ]);
  }
});

test("a phrase at the right wall continues through the first beat", () => {
  const editor = new HouseEditor();
  editor.setBand(false);
  editor.drawRoom({ x: 0, z: 0 }, { x: 4, z: 4 });
  const lamp = editor.place("lamp", { x: 3, z: 0 });
  editor.setPhrase(lamp.id, "arch");
  assert.deepEqual(Score.from(editor.house).events.map(event => event.beat), [0, 0.5, 3, 3.5]);
});
