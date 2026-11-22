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
  assert.equal(controls.selectedPiece.turn, 1);
});

test("two taps open the same surface once, after the second click", () => {
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
  controls.addEventListener("surface", e => opened.push(e.detail));
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
