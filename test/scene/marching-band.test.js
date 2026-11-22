import test from "node:test";
import assert from "node:assert/strict";
import { BandFloor } from "../../web/scene/band-floor.js";
import { MarchingBand } from "../../web/scene/marching-band.js";
import { nightGarden } from "../../web/houses/night-garden.js";

const camera = { width: 320, height: 250, scale: 28,
  project: ([x,y,z]) => ({ x: 120 + x * 24 - z * 14, y: 95 + z * 13 + x * 7 - y * 23 }) };
const positions = poses => poses.map(({x,z}) => [x,z]);
const frame = (band, t, house = nightGarden, reduced = false) => band.frame(house, camera, t, (t * 2) % 8, reduced);

test("a visit opens with three idle musicians in different rooms", () => {
  const band = new MarchingBand(true);
  const initial = band.frame(nightGarden, camera, 0, null);
  assert.equal(new Set(initial.map(p => p.instrument)).size, 3);
  assert.ok(initial.every(p => p.action === "idle"));
  const rooms = initial.map(p => nightGarden.rooms.find(r => p.x > r.x && p.x < r.x+r.width && p.z > r.z && p.z < r.z+r.depth));
  assert.equal(new Set(rooms).size, 3);
  assert.equal(band.frame(nightGarden, camera, 20, null), initial);
});

test("pause plants the feet and holds a queued departure until playback", () => {
  const band = new MarchingBand(true), muted = { ...nightGarden, band: false };
  let before;
  for (let i = 0; i <= 28; i++) before = frame(band,i/10);
  const parked = band.frame(nightGarden,camera,3,null);
  assert.deepEqual(positions(parked),positions(before));
  assert.ok(parked.every(p => p.action === "idle" && p.step === 0));
  assert.deepEqual(positions(band.frame(muted,camera,10,null)),positions(parked));
  let leaving = parked;
  for (let i = 101; i <= 410; i++) leaving = frame(band,i/10,muted);
  assert.deepEqual(leaving, []);
});

test("musicians visit other rooms, give individual kicks and keep clear of the furniture", () => {
  const band = new MarchingBand(true), floor = new BandFloor(nightGarden);
  const rooms = new Map(), kicks = new Set();
  for (let i = 0; i < 600; i++) {
    const poses = frame(band,i/10);
    for (const p of poses) {
      assert.ok(floor.free(p));
      const room = nightGarden.rooms.find(r => p.x > r.x && p.x < r.x+r.width && p.z > r.z && p.z < r.z+r.depth);
      if (!rooms.has(p.instrument)) rooms.set(p.instrument, new Set());
      if (room) rooms.get(p.instrument).add(room.id);
      if (p.action === "kick") kicks.add(p.instrument);
    }
  }
  assert.equal(kicks.size,3);
  assert.ok([...rooms.values()].every(visited => visited.size >= 2));
});

test("turning back mid-exit keeps the same positions and reduced motion skips kicks", () => {
  const band = new MarchingBand(true), muted = { ...nightGarden, band: false };
  frame(band,0);
  let leaving;
  for (let i = 1; i <= 8; i++) leaving = frame(band,i/10,muted);
  assert.deepEqual(positions(frame(band,0.8)),positions(leaving));
  for (let i = 9; i < 95; i++) assert.ok(frame(band,i/10,nightGarden,true).every(p => p.action !== "kick"));
});

test("the route between furnished rooms crosses their shared doorway", () => {
  const rooms = [{ id: "a", x: 0, z: 0, width: 4, depth: 4 }, { id: "b", x: 4, z: 0, width: 4, depth: 4 }];
  const doors = [{ rooms: ["a"], x: 1, z: 4 }, { rooms: ["a", "b"], x: 4, z: 3 }];
  const floor = new BandFloor({ rooms, doors, pieces: [{ kind: "table", roomId: "a", x: 1.45, z: 0.45, turn: 0 }] });
  const start = { x: 0.65, z: 0.6 }, end = { x: 7, z: 1 };
  const route = [start, ...floor.path(start, end)];
  assert.ok(route.slice(1).every((p, i) => floor.clear(route[i], p)));
  const i = route.findIndex(p => p.x > 4), a = route[i-1], b = route[i];
  const crossing = a.z + (4 - a.x) / (b.x - a.x) * (b.z - a.z);
  assert.ok(Math.abs(crossing - 3) < 0.33);
});
