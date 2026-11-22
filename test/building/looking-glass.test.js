import test from "node:test";
import assert from "node:assert/strict";
import { furniture } from "../../web/building/catalogue.js";
import { HouseEditor } from "../../web/building/house-editor.js";
import { LookingGlass } from "../../web/building/looking-glass.js";
import { houseFromLink, houseLink } from "../../web/library/house-format.js";

function parlour() {
  const editor = new HouseEditor(), glass = new LookingGlass();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const shelf = editor.place("bookcase", { x: 1, z: 1 });
  return { editor, shelf, read: () => glass.read(editor.house) };
}

test("the bedroom looking glass reveals writing only in the bookcase's room", () => {
  const { editor, shelf, read } = parlour();
  const kind = Object.keys(furniture).find(key => furniture[key].group === "Bedroom" && furniture[key].label === "Looking glass");
  assert.ok(kind);
  editor.drawRoom({ x: 8, z: 0 }, { x: 14, z: 6 });
  const mirror = editor.place(kind, { x: 9, z: 1 });
  assert.equal(read().writing.size, 0);
  editor.move(mirror.id, { x: 5, z: 1 });
  assert.equal(read().writing.get(shelf.id).pool, null);
  editor.undo();
  assert.equal(read().discoveries.length, 0);
});

test("three offerings on one shelf open water in its room", () => {
  const { editor, shelf, read } = parlour();
  const other = editor.place("bookcase", { x: 3, z: 1 });
  editor.place("mirror", { x: 5, z: 1 });
  editor.placeOn(shelf.id, "bottle", 0);
  const bell = editor.placeOn(shelf.id, "bell", 2);
  editor.placeOn(other.id, "grimoire", 2);
  assert.equal(read().discoveries[0].pool, null);
  editor.moveOn(bell.id, 1);
  assert.equal(read().discoveries[0].pool, null);
  editor.placeOn(shelf.id, "grimoire", 2);
  const [discovery] = read().discoveries;
  assert.ok(discovery.pool.radius > 1);
  editor.rotate(shelf.id);
  const shared = houseFromLink(houseLink(editor.house, "https://example.com/"));
  assert.deepEqual(new LookingGlass().read(shared).discoveries, read().discoveries);
  editor.undo();
  editor.undo();
  assert.equal(read().discoveries[0].pool, null);
  editor.redo();
  assert.deepEqual(read().discoveries[0].pool, discovery.pool);
});

test("the right objects in the wrong order keep the floor dry", () => {
  const { editor, shelf, read } = parlour();
  editor.place("mirror", { x: 5, z: 1 });
  editor.placeOn(shelf.id, "grimoire", 0);
  editor.placeOn(shelf.id, "bell", 1);
  const bottle = editor.placeOn(shelf.id, "bottle", 2);
  assert.equal(read().discoveries[0].pool, null);
  editor.moveOn(bottle.id, 0);
  assert.ok(read().discoveries[0].pool);
});
