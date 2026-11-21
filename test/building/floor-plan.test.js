import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { FloorPlan } from "../../web/building/floor-plan.js";

function joinedRooms() {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  editor.drawRoom({ x: 8.1, z: 2 }, { x: 12, z: 5 });
  return editor;
}

test("a doorway cuts a single opening in a partly shared wall", () => {
  const editor = joinedRooms();
  editor.addDoor({ x: 8, z: 3.5 });
  const shared = FloorPlan.walls(editor.house).filter(wall => wall.rooms.length === 2);
  assert.deepEqual(shared.map(wall => [wall.at, wall.start, wall.end]), [[8, 2, 3], [8, 4, 5]]);
});

test("undo restores a removed room with its door and furniture", () => {
  const editor = joinedRooms();
  editor.addDoor({ x: 8, z: 3.5 });
  editor.place("lamp", { x: 9, z: 3 });
  const furnished = editor.house;
  editor.remove(furnished.rooms[1].id);
  assert.deepEqual(editor.house.doors, []);
  assert.deepEqual(editor.house.pieces, []);
  editor.undo();
  assert.equal(editor.house, furnished);
});

test("a doorway fits an exactly one-unit shared span", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 4, z: 2.3 });
  editor.drawRoom({ x: 4, z: 1.3 }, { x: 8, z: 5 });
  editor.addDoor({ x: 4, z: 1.8 });
  assert.equal(FloorPlan.walls(editor.house).filter(wall => wall.rooms.length === 2).length, 0);
});

test("an invalid doorway point leaves the shared wall intact", () => {
  const editor = joinedRooms();
  assert.throws(() => editor.addDoor({ x: NaN, z: 3 }));
  assert.deepEqual(editor.house.doors, []);
});

test("a front door cuts just its own wall and can later join an extension", () => {
  const editor = new HouseEditor();
  const original = editor.drawRoom({ x: 0, z: 0 }, { x: 4, z: 4 });
  const door = editor.addDoor({ x: 2, z: 4 });
  assert.deepEqual(door.rooms, [original.id]);
  const walls = FloorPlan.walls(editor.house);
  assert.equal(walls.filter(wall => wall.axis === "x" && wall.at === 0).length, 1);
  assert.deepEqual(walls.filter(wall => wall.axis === "x" && wall.at === 4).map(wall => [wall.start, wall.end]), [[0, 1.5], [2.5, 4]]);
  assert.throws(() => editor.place("window", { x: 2, z: 4 }), /door/i);
  const extension = editor.drawRoom({ x: 1, z: 4 }, { x: 4, z: 7 });
  assert.deepEqual(editor.house.doors[0].rooms, [original.id, extension.id]);
  editor.undo();
  assert.deepEqual(editor.house.doors[0], door);
});
