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
