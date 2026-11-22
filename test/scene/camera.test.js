import test from "node:test";
import assert from "node:assert/strict";
import { HouseScene } from "../../web/scene/house-scene.js";

test("pan and pinch keep the grabbed ground point under the pointer", () => {
  const canvas = { dataset: {}, getContext: () => null, getBoundingClientRect: () => ({ left: 37, top: 60, width: 680, height: 350 }) };
  const scene = new HouseScene(canvas);
  scene.orbit(64, 27);
  const from = { x: 171, y: 145 }, to = { x: 263, y: 188 };
  for (const zoom of [1, 1.6, 0.8]) {
    const held = scene.groundAt(from.x, from.y);
    scene.pan(from, to, zoom);
    const screen = scene.screenAt(held);
    assert.ok(Math.hypot(screen.x - to.x, screen.y - to.y) < 1e-8);
  }
  scene.fit();
  assert.deepEqual(scene.center, [0, 0.65, 0]);
});
