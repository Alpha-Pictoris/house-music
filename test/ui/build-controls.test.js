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
