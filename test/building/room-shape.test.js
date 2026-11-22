import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { FloorPlan } from "../../web/building/floor-plan.js";
import { houseFromLink, houseLink, readHouse } from "../../web/library/house-format.js";
import { BandFloor } from "../../web/scene/band-floor.js";

const point = (x,z) => ({ x,z });

test("extending a room keeps its furniture and opens the former wall", () => {
  const editor = new HouseEditor();
  const {id} = editor.drawRoom(point(0,0),point(4,4));
  editor.styleRoom(id,{ name: "Parlour", finish: "moss" });
  const lamp = editor.place("lamp",point(1,1));
  editor.addDoor(point(4,3));
  const before = editor.house;
  const extension = editor.drawRoom(point(2,2),point(8,4));
  assert.equal(extension.id,id);
  assert.deepEqual([extension.name,extension.finish],["Parlour","moss"]);
  assert.deepEqual(editor.house.pieces,[lamp]);
  assert.equal(editor.house.rooms.length,1);
  assert.deepEqual(editor.house.doors,[]);
  assert.equal(FloorPlan.doorAt(editor.house,point(4,3),0.01),null);
  const floor = new BandFloor(editor.house);
  assert.ok(floor.clear(point(3.5,3),point(6,3)));
  assert.ok(floor.groundAt(point(6,1)) < 0);
  editor.undo();
  assert.equal(editor.house,before);
});

test("a concave room accepts pieces across its join and leaves its notch outdoors", () => {
  const editor = new HouseEditor();
  editor.drawRoom(point(0,0),point(4,4));
  editor.drawRoom(point(2,2),point(8,4));
  const house = editor.house;
  assert.equal(FloorPlan.roomAt(house,point(6,1)),undefined);
  const sofa = editor.place("sofa",point(3,2.3));
  assert.throws(() => editor.move(sofa.id,point(3,1.7)),/inside/);
  editor.place("tree",point(5,0));
  const window = editor.place("window",point(6,2));
  assert.equal(window.turn,0);
  assert.deepEqual(houseFromLink(houseLink(editor.house,"https://example.com/")),editor.house);
});

test("a neighbouring room can fill a notch and share both of its walls", () => {
  const editor = new HouseEditor();
  editor.drawRoom(point(0,0),point(4,4));
  editor.drawRoom(point(2,2),point(8,4));
  editor.drawRoom(point(8,0),point(4,2));
  const walls = FloorPlan.wallSpans(editor.house).filter(w => w.rooms.length === 2);
  assert.deepEqual(new Set(walls.map(w => w.axis)),new Set(["x","z"]));
  assert.equal(editor.addDoor(point(6,2)).rooms.length,2);
  assert.throws(() => editor.drawRoom(point(2,1),point(6,3)));
});

test("a room file cannot join disconnected floor sections", () => {
  const r = { x:0,z:0,width:2,depth:2 };
  const room = {...r,id:"r",width:6,sections:[r,{...r,x:4}]};
  assert.throws(() => readHouse({...new HouseEditor().house,rooms:[room]}),/edge/);
});

test("an overlapping stroke extends the same room in either direction", () => {
  function extend(a, b) {
    const editor = new HouseEditor();
    editor.drawRoom(point(0,0),point(4,4));
    const room = editor.drawRoom(a,b);
    assert.equal(editor.house.rooms.length,1);
    return room;
  }
  const a = point(1,-2), b = point(3,6);
  assert.deepEqual(extend(a,b),extend(b,a));
});
