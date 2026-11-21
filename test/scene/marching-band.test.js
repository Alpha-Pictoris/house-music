import test from "node:test";
import assert from "node:assert/strict";
import { MarchingBand } from "../../web/scene/marching-band.js";

const camera = { width: 320, height: 250, scale: 28,
  project: ([x,y,z]) => ({ x: 150 + x * 24 - z * 14, y: 110 + z * 13 + x * 7 - y * 23 }) };
const plot = { rooms: [], pieces: [] };
const house = { ...plot, rooms: [{ x: 0, z: 0, width: 5, depth: 4 }] };
const outside = player => {
  const { x, y } = camera.project([player.x, 1, player.z]);
  return x < 0 || x > camera.width || y < 0 || y > camera.height;
};
const positions = poses => poses.map(({x,z}) => [x,z]);

test("players walk on from outside the plot and leave beyond the frame", () => {
  const band = new MarchingBand();
  assert.deepEqual(band.frame(plot, camera, 0, null), []);
  let players = band.frame(house, camera, 0.1, null);
  assert.deepEqual(players.map(p => p.instrument), ["trombone", "drum", "sousaphone"]);
  assert.ok(players.every(outside));
  for (let i=2; i<=65; i++) players = band.frame(house, camera, i/10, i/10);
  assert.ok(players.some(p => !outside(p)));
  for (let i=66; i<=290; i++) {
    const next = band.frame({ ...house, band: false }, camera, i/10, null);
    for (const p of players) if (!next.some(n => n.instrument === p.instrument)) assert.ok(outside(p));
    players = next;
  }
  assert.deepEqual(players, []);
});

test("reversing a departure keeps every player on their feet at the same spot", () => {
  const band = new MarchingBand(), muted = { ...house, band: false };
  for (let i=0; i<50; i++) band.frame(house, camera, i/10, null);
  let before;
  for (let i=50; i<=54; i++) before = band.frame(muted, camera, i/10, null);
  const departing = band.frame(muted, camera, 5.5, null);
  assert.deepEqual(positions(band.frame(house, camera, 5.5, null)), positions(departing));
  const returning = band.frame(house, camera, 5.65, null);
  returning.forEach((p, i) => {
    const dx = p.x - departing[i].x, dz = p.z - departing[i].z;
    assert.ok(Math.hypot(dx, dz) < 0.55);
    assert.ok(dx * (departing[i].x - before[i].x) + dz * (departing[i].z - before[i].z) < 0);
  });
});

test("reduced motion lets the trio arrive and stand still until dismissed", () => {
  const band = new MarchingBand();
  let settled;
  for (let i=0; i<=165; i++) settled = band.frame(house,camera,i/10,null,true);
  assert.equal(settled.length,3);
  assert.ok(settled.every(p => !outside(p) && p.lift===0 && p.sway===0));
  assert.equal(band.frame(house,camera,17,2,true),settled);
  band.frame({ ...house, band: false },camera,17.1,null,true);
  const leaving = band.frame({ ...house, band: false },camera,17.3,null,true);
  assert.notDeepEqual(positions(leaving),positions(settled));
});
