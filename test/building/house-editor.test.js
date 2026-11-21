import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";

function parlour() {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  return editor;
}

test("a new plot has no rooms, doors or furniture", () => {
  const { rooms, doors, pieces } = new HouseEditor().house;
  assert.deepEqual([rooms, doors, pieces], [[], [], []]);
});

test("drawing backwards leaves one unfurnished room", () => {
  const editor = new HouseEditor();
  const room = editor.drawRoom({ x: 8, z: 6 }, { x: 0, z: 0 });
  assert.deepEqual(room, { id: room.id, x: 0, z: 0, width: 8, depth: 6 });
  assert.deepEqual(editor.house.pieces, []);
  editor.undo();
  assert.deepEqual(editor.house.rooms, []);
});

test("an overlapping drop preserves the last valid placement", () => {
  const editor = parlour();
  const wardrobe = editor.place("wardrobe", { x: 1, z: 1 });
  editor.place("lamp", { x: 5, z: 1 });
  const before = editor.house;
  assert.throws(() => editor.move(wardrobe.id, { x: 5, z: 1 }));
  assert.equal(editor.house, before);
});

test("one undo reverses a move and redo restores it", () => {
  const editor = parlour();
  const piece = editor.place("mirror", { x: 1, z: 1 });
  editor.move(piece.id, { x: 4, z: 2 });
  editor.undo();
  assert.equal(editor.house.pieces[0].x, 1);
  editor.redo();
  assert.equal(editor.house.pieces[0].x, 4);
});

test("tuning a duplicate leaves the original guitar pitch alone", () => {
  const editor = parlour();
  const guitar = editor.place("wardrobe", { x: 1, z: 1 });
  const copy = editor.duplicate(guitar.id, { x: 4, z: 1 });
  editor.tune(copy.id, 55);
  assert.deepEqual(editor.house.pieces.map(piece => piece.pitch), [50, 55]);
});
