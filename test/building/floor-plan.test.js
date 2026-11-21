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
