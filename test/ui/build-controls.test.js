import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { BuildControls } from "../../web/ui/build-controls.js";

test("modified canvas keys leave browser shortcuts and global undo available", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const sofa = editor.place("sofa", { x: 2, z: 2 });
  const canvas = new EventTarget();
  const controls = new BuildControls(canvas, {}, editor, assert.fail);
  controls.select(sofa.id);

  function press(key, modifiers = {}) {
    return canvas.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key }, modifiers));
  }

  const original = editor.house;
  assert.equal(press("r", { ctrlKey: true }), true);
  assert.equal(press("r", { metaKey: true }), true);
  assert.equal(press("ArrowLeft", { altKey: true }), true);
  assert.equal(press("z", { ctrlKey: true }), true);
  assert.equal(editor.house, original);

  press("r");
  assert.equal(controls.selectedPiece.turn, 3);
  press(",");
  assert.equal(controls.selectedPiece.turn, 0);
});

test("a turn before placement carries into the room and can be reversed in place", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: -3, z: -3 }, { x: 5, z: 5 });
  const canvas = new EventTarget(), controls = new BuildControls(canvas, {}, editor, () => {});
  const key = key => canvas.dispatchEvent(Object.assign(new Event("keydown"), { key }));
  controls.choose("sofa");
  key(".");
  assert.equal(controls.preview.piece.turn, 3);
  key("Enter");
  const { id, x, z } = controls.selectedPiece;
  key(",");
  assert.deepEqual([controls.selectedPiece.id, controls.selectedPiece.x, controls.selectedPiece.z, controls.selectedPiece.turn], [id, x, z, 0]);
  editor.undo();
  assert.equal(controls.selectedPiece.turn, 3);
});

test("a pinch or middle drag while building leaves the room unbuilt", () => {
  const canvas = Object.assign(new EventTarget(), { focus() {}, setPointerCapture() {}, hasPointerCapture: () => false });
  const editor = new HouseEditor(), pans = [];
  const scene = { groundAt: (x, z) => ({ x, z }), pan: (...args) => pans.push(args) };
  new BuildControls(canvas, scene, editor, assert.fail);
  function pointer(action, pointerId, x, z, pointerType = "touch", button = 0) {
    canvas.dispatchEvent(Object.assign(new Event("pointer" + action), { pointerId, clientX: x, clientY: z, pointerType, button }));
  }
  pointer("down", 1, 0, 0); pointer("down", 2, 10, 0);
  pointer("move", 2, 20, 0); pointer("up", 1, 0, 0);
  pointer("move", 2, 22, 2); pointer("up", 2, 22, 2);
  pointer("down", 3, 0, 0, "mouse", 1); pointer("move", 3, 10, 8, "mouse", 1); pointer("up", 3, 10, 8, "mouse", 1);
  assert.equal(pans.length, 2);
  assert.deepEqual([pans[0][0].x, pans[0][1].x, pans[0][2]], [5, 10, 2]);
  assert.equal(editor.house.rooms.length, 0);
});

test("a double tap opens the selected table once", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 6, z: 4 });
  const table = editor.place("table", { x: 1, z: 1 });
  const canvas = Object.assign(new EventTarget(), {
    focus() {}, setPointerCapture() {}, hasPointerCapture: () => false
  });
  const scene = { groundAt: () => ({ x: 1, z: 1 }), pick: () => table.id };
  const controls = new BuildControls(canvas, scene, editor, () => {});
  controls.use("select");
  const opened = [];
  controls.addEventListener("arrange", e => opened.push(e.detail));
  function touch(type, id, time) {
    const event = Object.assign(new Event(type), { pointerId: id, pointerType: "touch", button: 0, clientX: 4, clientY: 8 });
    Object.defineProperty(event, "timeStamp", { value: time });
    canvas.dispatchEvent(event);
  }
  touch("pointerdown",1,10);
  touch("pointerup",1,55);
  canvas.dispatchEvent(new Event("click"));
  touch("pointerdown",2,180);
  touch("pointerup",2,550);
  assert.deepEqual(opened,[]);
  canvas.dispatchEvent(new Event("click"));
  assert.deepEqual(opened,[table.id]);
});

test("dragging a portrait drops furniture only on the plot", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 6, z: 4 });
  const canvas = Object.assign(new EventTarget(), { setPointerCapture() {}, hasPointerCapture: () => false });
  canvas.ownerDocument = { elementFromPoint: x => x === 2 ? canvas : null };
  const scene = { groundAt: (x, z) => ({ x, z }) };
  const controls = new BuildControls(canvas, scene, editor, () => {});
  const finger = { pointerId: 1, pointerType: "touch", clientX: 2, clientY: 1 };
  for (const clientX of [3, 2]) {
    controls.carry("chair", finger);
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), finger, { clientX }));
  }
  assert.deepEqual(editor.house.pieces.map(p => [p.kind, p.x, p.z]), [["chair", 2, 1]]);
});

test("bracket keys cycle through the house in either direction", () => {
  const editor = new HouseEditor();
  const room = editor.drawRoom({ x: 0, z: 0 }, { x: 5, z: 5 });
  const lamp = editor.place("lamp", { x: 2, z: 2 });
  const canvas = new EventTarget(), controls = new BuildControls(canvas, {}, editor, () => {});
  for (const [key, id] of [["[", lamp.id], ["]", room.id], ["]", lamp.id]]) {
    canvas.dispatchEvent(Object.assign(new Event("keydown"), { key }));
    assert.equal(controls.selection, id);
  }
});

function bedroomControls() {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const wardrobe = editor.place("wardrobe", { x: 1, z: 1 });
  editor.place("lamp", { x: 6, z: 1 });
  editor.place("rug", { x: 4, z: 3.5 });
  const canvas = Object.assign(new EventTarget(), { focus() {}, setPointerCapture() {}, hasPointerCapture: () => false });
  const picked = [];
  const scene = { groundAt: (x, z) => ({ x: x / 100, z: z / 100 }), pick: () => picked[0] ?? null, orbit() {}, enter() {} };
  const controls = new BuildControls(canvas, scene, editor, () => {});
  controls.use("select");
  function pointer(action, x, z, pointerType, timeStamp = 0) {
    const event = Object.assign(new Event("pointer" + action), { pointerId: 1, clientX: x * 100, clientY: z * 100, pointerType, button: 0 });
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
    canvas.dispatchEvent(event);
  }
  const tap = (x, z, type, time) => { pointer("down", x, z, type, time); pointer("up", x, z, type, time); };
  const drag = (from, to, type) => {
    pointer("down", ...from, type);
    pointer("move", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, type);
    pointer("up", ...to, type);
  };
  const key = (key, more = {}) => canvas.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key }, more));
  return { editor, wardrobe, canvas, controls, picked, tap, drag, key };
}

for (const type of ["mouse", "touch"]) {
  test("a " + type + " tap on the rug's shadow turns the house over, and a drag there moves a shadow", () => {
    const { editor, wardrobe, controls, picked, tap, drag } = bedroomControls();
    const piece = () => editor.house.pieces.find(item => item.id === wardrobe.id);
    tap(5, 4, type);
    assert.equal(controls.flipped, false);
    tap(6.8, 5.4, type);
    assert.equal(controls.flipped, true);

    picked.push(wardrobe.id);
    drag([1.5, 1.5], [3.5, 3.5], type);
    assert.deepEqual([piece().shadow, piece().x, controls.selection], [{ x: 3, z: 3 }, 1, wardrobe.id]);
    const before = editor.house;
    drag([3.5, 3.5], [3.5, 9], type);
    assert.equal(editor.house, before);

    picked.length = 0;
    tap(5, 4, type);
    assert.equal(controls.flipped, false);
  });
}

test("on the B-side the arrow keys carry the selected shadow and building turns the house back", () => {
  const { editor, wardrobe, controls, key } = bedroomControls();
  const piece = () => editor.house.pieces.find(item => item.id === wardrobe.id);
  controls.turnOver();
  key("]");
  assert.equal(controls.selection, wardrobe.id);
  key("ArrowRight");
  assert.deepEqual([piece().shadow, piece().x], [{ x: 1.25, z: 1 }, 1]);
  key("Delete");
  assert.ok(piece());
  controls.callShadow();
  assert.equal(piece().shadow, undefined);
  controls.use("room");
  assert.equal(controls.flipped, false);
});

test("on the B-side a double tap or Enter asks to open the monitor", () => {
  const { editor, canvas, controls, picked, tap, key } = bedroomControls();
  controls.turnOver();
  const opened = [];
  controls.addEventListener("monitor", () => opened.push(true));
  picked.push(controls.side.read(editor.house).monitor.id);
  for (const time of [0, 200]) {
    tap(3.9, 0.8, "touch", time);
    canvas.dispatchEvent(new Event("click"));
  }
  assert.equal(opened.length, 1);
  key("Enter");
  assert.equal(opened.length, 2);
});
