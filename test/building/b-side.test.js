import test from "node:test";
import assert from "node:assert/strict";
import { BSide } from "../../web/building/b-side.js";
import { HouseEditor } from "../../web/building/house-editor.js";
import { houseFromLink, houseLink } from "../../web/library/house-format.js";

function bedroom() {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const wardrobe = editor.place("wardrobe", { x: 1, z: 1 });
  const rug = editor.place("rug", { x: 4, z: 3.5 });
  return { editor, wardrobe, rug };
}

const wardrobeIn = editor => editor.house.pieces.find(piece => piece.kind === "wardrobe");

test("a rug has a shadow to turn the house over by once a lamp shares its room", () => {
  const { editor, rug } = bedroom();
  const side = new BSide();
  assert.equal(side.read(editor.house).open, false);
  editor.drawRoom({ x: 8, z: 0 }, { x: 14, z: 6 });
  const lamp = editor.place("lamp", { x: 10, z: 1 });
  assert.equal(side.read(editor.house).open, false);

  editor.move(lamp.id, { x: 6, z: 1 });
  const { open, hatches, monitor } = side.read(editor.house);
  assert.deepEqual([open, hatches.map(hatch => hatch.id), monitor.roomId], [true, [rug.id], rug.roomId]);
  assert.equal(BSide.hatchAt({ hatches }, { x: 6.8, z: 5.4 }, false)?.id, rug.id);
  assert.equal(BSide.hatchAt({ hatches }, { x: 5, z: 4 }, false), null);
  assert.equal(BSide.hatchAt({ hatches }, { x: 5, z: 4 }, true)?.id, rug.id);
});

test("the B-side holds a shadow for each musical furnishing and the monitor stands on clear floor", () => {
  const { editor, wardrobe } = bedroom();
  const lamp = editor.place("lamp", { x: 6, z: 1 });
  editor.place("chair", { x: 1, z: 4 });
  const { shadows, monitor } = new BSide().read(editor.house);
  assert.deepEqual(shadows.map(piece => piece.id), [wardrobe.id, lamp.id]);
  editor.place("monitor", monitor);
});

test("a moved shadow stays put while its wardrobe crosses the room, and one undo returns it", () => {
  const { editor, wardrobe } = bedroom();
  editor.moveShadow(wardrobe.id, { x: 5, z: 1 });
  editor.move(wardrobe.id, { x: 1, z: 3 });
  assert.deepEqual(wardrobeIn(editor).shadow, { x: 5, z: 1 });
  editor.moveShadow(wardrobe.id, { x: 6, z: 1 });
  editor.undo();
  assert.deepEqual(wardrobeIn(editor).shadow, { x: 5, z: 1 });
});

test("a shadow dropped outside the room or in an alcove's missing corner keeps its place", () => {
  const { editor, wardrobe } = bedroom();
  editor.drawRoom({ x: 7, z: 2 }, { x: 11, z: 6 });
  editor.moveShadow(wardrobe.id, { x: 5, z: 1 });
  const before = editor.house;
  assert.throws(() => editor.moveShadow(wardrobe.id, { x: 8.5, z: 0.2 }), /inside its room/);
  assert.throws(() => editor.moveShadow(wardrobe.id, { x: 20, z: 3 }), /inside its room/);
  assert.equal(editor.house, before);
});

test("a shadow dropped at the wardrobe's feet or called back stands under it again", () => {
  const { editor, wardrobe } = bedroom();
  editor.moveShadow(wardrobe.id, { x: 1.25, z: 1 });
  assert.deepEqual(wardrobeIn(editor).shadow, { x: 1.25, z: 1 });
  editor.moveShadow(wardrobe.id, { x: 1.1, z: 1.1 });
  assert.equal(wardrobeIn(editor).shadow, undefined);
  editor.moveShadow(wardrobe.id, { x: 5, z: 1 });
  assert.equal(editor.callShadow(wardrobe.id).shadow, undefined);
});

test("moving to another room, losing the fitting or being copied leaves a shadow at the feet", () => {
  const { editor, wardrobe } = bedroom();
  editor.drawRoom({ x: 8, z: 0 }, { x: 14, z: 6 });
  editor.moveShadow(wardrobe.id, { x: 5, z: 1 });
  assert.equal(editor.duplicate(wardrobe.id, { x: 1, z: 4.5 }).shadow, undefined);
  assert.equal(editor.fitPiece(wardrobe.id, "plain").shadow, undefined);
  editor.undo();
  assert.equal(editor.move(wardrobe.id, { x: 10, z: 1 }).shadow, undefined);
});

test("a share link carries moved shadows and refuses one outside its room or under a silent piece", () => {
  const { editor, wardrobe } = bedroom();
  editor.place("lamp", { x: 6, z: 1 });
  editor.moveShadow(wardrobe.id, { x: 1, z: 2.5 });
  const link = houseLink(editor.house, "https://house.example/");
  assert.deepEqual(houseFromLink(link).pieces.map(piece => piece.shadow), editor.house.pieces.map(piece => piece.shadow));

  const outside = structuredClone(editor.house);
  outside.pieces.find(piece => piece.kind === "wardrobe").shadow = { x: 30, z: 0.5 };
  assert.throws(() => houseLink(outside, "https://house.example/"), /inside its room/);
  const silent = structuredClone(editor.house);
  silent.pieces.find(piece => piece.kind === "rug").shadow = { x: 4, z: 3.5 };
  assert.throws(() => houseLink(silent, "https://house.example/"), /musical fitting/);
});
