import { furniture } from '../building/catalogue.js';
import { FloorPlan } from '../building/floor-plan.js';

import { RoomShape } from '../building/room-shape.js';

const clearance = 0.18;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inside = (p, b) => p.x > b.left && p.x < b.right && p.z > b.back && p.z < b.front;

function blocker(x, z, width, depth) {
  return { left: x - clearance, right: x + width + clearance, back: z - clearance, front: z + depth + clearance };
}

function crosses(a, b, box) {
  let first = 0, last = 1;
  for (const [axis, low, high] of [['x', box.left, box.right], ['z', box.back, box.front]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-8) {
      if (a[axis] <= low || a[axis] >= high) return false;
    } else {
      const near = (low - a[axis]) / delta, far = (high - a[axis]) / delta;
      first = Math.max(first, Math.min(near, far));
      last = Math.min(last, Math.max(near, far));
      if (first >= last - 1e-8) return false;
    }
  }
  return true;
}

export class BandFloor {
  #obstacles;
  #corners;
  #links = new Map();

  constructor(house) {
    this.rooms = house.rooms;
    const hasEntrance = house.doors.some(door => door.rooms.length === 1);
    this.#obstacles = FloorPlan.walls(house).flatMap(({ axis, at, start, end, rooms, back }) => {
      // A house without a front door can be entered over the low lip of its cutaway.
      if (!hasEntrance && rooms.length === 1 && !back) return [];
      return [axis === 'x' ? blocker(start, at, end - start, 0) : blocker(at, start, 0, end - start)];
    });
    const solid = house.pieces.filter(piece => !furniture[piece.kind].layer).map(piece => FloorPlan.footprint(piece));
    for (const { x, z, width, depth } of solid) this.#obstacles.push(blocker(x, z, width, depth));
    const land = [...house.rooms, ...solid];
    const left = Math.min(...land.map(b => b.x)), right = Math.max(...land.map(b => b.x + b.width));
    const back = Math.min(...land.map(b => b.z)), front = Math.max(...land.map(b => b.z + b.depth));
    this.gates = [
      { x: left - 0.65, z: front + 0.55, dx: -0.85, dz: 0.53 },
      { x: left * 0.38 + right * 0.62, z: front + 0.75, dx: 0.35, dz: 0.94 },
      { x: right + 0.75, z: front * 0.54 + back * 0.46, dx: 0.96, dz: -0.28 }
    ];
    this.spots = this.rooms.map(room => {
      const spots = [];
      for (const part of RoomShape.parts(room)) for (const z of [0.33, 0.68, 0.5, 0.84, 0.16]) for (const x of [0.32, 0.71, 0.5, 0.85, 0.15]) {
        const p = { x: part.x + x * part.width, z: part.z + z * part.depth };
        if (this.free(p)) spots.push(p);
      }
      return spots;
    }).filter(spots => spots.length);
  }

  free(point) { return !this.#obstacles.some(box => inside(point, box)); }
  clear(a, b) { return !this.#obstacles.some(box => crosses(a, b, box)); }

  #vertices() {
    if (this.#corners) return this.#corners;
    const points = new Map();
    for (const box of this.#obstacles) {
      for (const x of [box.left - 0.004, box.right + 0.004]) for (const z of [box.back - 0.004, box.front + 0.004]) {
        const p = { x, z };
        if (this.free(p)) points.set(x + '/' + z, p);
      }
    }
    this.#corners = [...points.values()];
    return this.#corners;
  }

  #neighbors(point) {
    if (!this.#links.has(point)) this.#links.set(point, this.#vertices().filter(p => p !== point && this.clear(point, p)));
    return this.#links.get(point);
  }

  path(start, end) {
    if (!this.free(end)) return null;
    if (this.clear(start, end)) return [end];
    const corners = this.#vertices();
    if (!this.free(start)) {
      const escape = corners.reduce((best, p) => !best || distance(start, p) < distance(start, best) ? p : best, null);
      const rest = escape && this.path(escape, end);
      return rest ? [escape, ...rest] : null;
    }
    const cost = new Map([[start, 0]]), previous = new Map();
    const open = [{ p: start, estimate: distance(start, end) }], closed = new Set();
    while (open.length) {
      open.sort((a, b) => b.estimate - a.estimate);
      const { p } = open.pop();
      if (closed.has(p)) continue;
      if (this.clear(p, end)) {
        const route = [end];
        for (let at = p; at !== start; at = previous.get(at)) route.unshift(at);
        return route;
      }
      closed.add(p);
      const neighbors = p === start ? corners.filter(c => this.clear(p, c)) : this.#neighbors(p);
      for (const next of neighbors) {
        const total = cost.get(p) + distance(p, next);
        if (closed.has(next) || total >= (cost.get(next) ?? Infinity) - 1e-7) continue;
        cost.set(next, total);
        previous.set(next, p);
        open.push({ p: next, estimate: total + distance(next, end) });
      }
    }
    return null;
  }

  destinations(player, visit) {
    const places = [];
    for (let i = 0; i < this.spots.length; i++) {
      const room = this.spots[(player + visit + i) % this.spots.length];
      places.push(room[(player * 11 + visit * 7) % room.length]);
    }
    const garden = this.gates[(player + visit) % this.gates.length];
    if (visit % 5 === 4) places.unshift(garden);
    else places.push(garden);
    return places;
  }

  groundAt(point) {
    return this.rooms.some(r => RoomShape.at(r, point)) ? 0.015 : -0.067;
  }
}
