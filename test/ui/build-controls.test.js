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
