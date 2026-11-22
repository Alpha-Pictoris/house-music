import test from "node:test";
import assert from "node:assert/strict";
import { placeBookplate } from "../../web/ui/bookplate.js";

const size = { width: 240, height: 130 };

test("the note clears the shelf and points back to it", () => {
  const note = placeBookplate({ x: 320, y: 300 }, size, { left: 10, right: 700, top: 80, bottom: 520 });
  assert.ok(note.top + size.height < 300);
  assert.equal(note.threadX, 320);
  assert.equal(note.threadY, note.top + size.height);
});

test("a note near either edge of a phone stays on the plot", () => {
  const bounds = { left: 8, right: 312, top: 95, bottom: 525 };
  for (const point of [{ x: 5, y: 105 }, { x: 308, y: 110 }, { x: 305, y: 505 }]) {
    const note = placeBookplate(point, size, bounds);
    assert.ok(note.left >= bounds.left && note.left + size.width <= bounds.right);
    assert.ok(note.top >= bounds.top && note.top + size.height <= bounds.bottom);
  }
});

test("a shelf near the top leaves its full width clear beside the note", () => {
  const bounds = { left: 8, right: 1100, top: 100, bottom: 690 };
  const left = placeBookplate({ x: 510, y: 140 }, size, bounds, 75);
  const right = placeBookplate({ x: 650, y: 140 }, size, bounds, 75);
  assert.ok(left.left + size.width < 510 - 75);
  assert.ok(right.left > 650 + 75);
});
