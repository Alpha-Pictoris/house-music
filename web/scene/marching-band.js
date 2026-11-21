import { furniture } from '../building/catalogue.js';
import { FloorPlan } from '../building/floor-plan.js';

const instruments = ['trombone', 'drum', 'sousaphone'];
const entrance = [-0.85, 0.53];
const tau = 2 * Math.PI;
const empty = [];
const lerp = (a, b, t) => a + (b - a) * t;

class ParadeRoute {
  constructor(house) {
    const obstacles = house.pieces.filter(piece => furniture[piece.kind].garden && furniture[piece.kind].layer !== 'floor');
    const boxes = [...house.rooms, ...obstacles.map(piece => FloorPlan.footprint(piece))];
    const left = Math.min(...boxes.map(box => box.x)) - 0.72;
    const right = Math.max(...boxes.map(box => box.x + box.width)) + 0.72;
    const back = Math.min(...boxes.map(box => box.z)) - 0.72;
    const front = Math.max(...boxes.map(box => box.z + box.depth)) + 0.72;
    this.bounds = [left, right, back, front];
    const bend = 0.43;
    this.points = [[left + bend, front], [right - bend, front], [right, front - bend], [right, back + bend],
      [right - bend, back], [left + bend, back], [left, back + bend], [left, front - bend]];
    this.length = 0;
    this.edges = this.points.map(([x, z], i) => {
      const [endX, endZ] = this.points[(i + 1) % this.points.length];
      const length = Math.hypot(endX - x, endZ - z);
      const edge = { x, z, dx: (endX - x) / length, dz: (endZ - z) / length, start: this.length, length };
      this.length += length;
      return edge;
    });
  }

  at(distance) {
    const along = distance % this.length;
    const edge = this.edges.findLast(edge => edge.start <= along);
    return { x: edge.x + edge.dx * (along - edge.start), z: edge.z + edge.dz * (along - edge.start),
      dx: edge.dx, dz: edge.dz };
  }

  nearest(x, z) {
    let best = Infinity, distance = 0;
    for (const edge of this.edges) {
      const along = Math.max(0, Math.min(edge.length, (x - edge.x) * edge.dx + (z - edge.z) * edge.dz));
      const gap = Math.hypot(x - edge.x - along * edge.dx, z - edge.z - along * edge.dz);
      if (gap < best) { best = gap; distance = edge.start + along; }
    }
    return distance % this.length;
  }
}

function offstage(camera, x, z, [dx, dz]) {
  const start = camera.project([x, 0, z]), next = camera.project([x + dx, 0, z + dz]);
  const margin = 2.3 * camera.scale + 6;
  const edge = (at, velocity, size) => Math.abs(velocity) < 0.0001 ? Infinity :
    ((velocity > 0 ? size + margin : -margin) - at) / velocity;
  return Math.max(0, Math.min(edge(start.x, next.x - start.x, camera.width), edge(start.y, next.y - start.y, camera.height)));
}

export class MarchingBand {
  #rooms;
  #pieces;
  #route;
  #players = [];
  #time;
  #poses = empty;
  #enabled = false;

  #grounds(house) {
    if (this.#rooms === house.rooms && this.#pieces === house.pieces) return;
    this.#rooms = house.rooms;
    this.#pieces = house.pieces;
    if (!house.rooms.length) return;
    const route = new ParadeRoute(house);
    if (this.#route?.bounds.every((n, i) => n === route.bounds[i])) return;
    for (const player of this.#players) {
      const last = this.#route.at(player.distance);
      player.distance = route.nearest(last.x, last.z);
    }
    this.#route = route;
  }

  #enter(camera) {
    this.#players = instruments.map((instrument, i) => {
      const distance = (2 - i) * 0.97 + 0.12;
      const { x, z } = this.#route.at(distance);
      const away = offstage(camera, x, z, entrance) + 0.28 + i * 0.75;
      return { instrument, distance, away, exit: entrance, x: x + away * entrance[0], z: z + away * entrance[1],
        angle: Math.atan2(-entrance[0], -entrance[1]) };
    });
  }

  frame(house, camera, time, beat, reduced = false) {
    this.#grounds(house);
    const enabled = house.band !== false && house.rooms.length > 0;
    const switched = enabled !== this.#enabled;
    if (!switched && this.#time !== undefined && time - this.#time < 1 / 15) return this.#poses;
    const dt = Math.max(0, Math.min(0.45, time - (this.#time ?? time)));
    this.#time = time;
    this.#enabled = enabled;
    if (!this.#players.length) {
      if (!enabled) return empty;
      this.#enter(camera);
    }
    const poses = [];
    const stride = Math.max(2.65, 0.18 * camera.width / camera.scale);
    const music = beat ?? time * 1.55;
    for (const [i, player] of this.#players.entries()) {
      let point = this.#route.at(player.distance);
      if (switched && !enabled && player.away === 0) {
        // The left normal faces outwards along the entire circuit.
        player.exit = [0.9 * -point.dz - 0.436 * point.dx, 0.9 * point.dx - 0.436 * point.dz];
      }
      const dancing = enabled && !reduced && player.away === 0 && music % 4 >= 2.25;
      if (!enabled) player.away += dt * stride;
      else if (player.away > 0) player.away = Math.max(0, player.away - dt * stride);
      else if (!dancing && !reduced) {
        player.distance = (player.distance + dt * (beat === null ? 1.15 : 1.75)) % this.#route.length;
        point = this.#route.at(player.distance);
      }
      const x = point.x + player.away * player.exit[0], z = point.z + player.away * player.exit[1];
      const dx = x - player.x, dz = z - player.z, gap = Math.hypot(dx, dz);
      const travel = Math.min(1, dt * stride / (gap || 1));
      player.x = lerp(player.x, x, travel);
      player.z = lerp(player.z, z, travel);
      if (!enabled && offstage(camera, player.x, player.z, player.exit) === 0) continue;
      const facing = dancing ? 0.35 + 0.23 * Math.sin(music * Math.PI) : gap > 0.002 ? Math.atan2(dx, dz) : player.angle;
      const turn = Math.atan2(Math.sin(facing - player.angle), Math.cos(facing - player.angle));
      player.angle += turn * Math.min(1, dt * 8);
      const cycle = ((enabled && player.away === 0 ? music / 2 : time * 1.48) + i * 0.09) % 1;
      const still = reduced && enabled && player.away === 0;
      poses.push({ instrument: player.instrument, x: player.x, z: player.z, angle: player.angle,
        step: reduced ? (still ? 0 : Math.floor(cycle * 4) * 3) : Math.floor(cycle * 12),
        lift: reduced ? 0 : (dancing ? 0.15 : 0.048) * (1 - Math.cos(tau * cycle * 2)) / 2,
        sway: dancing ? 0.085 * Math.sin(tau * cycle) : 0 });
    }
    if (!poses.length) this.#players = [];
    if (reduced && !switched && poses.length === this.#poses.length && poses.every((p, i) => {
      const old = this.#poses[i];
      return old && p.x === old.x && p.z === old.z && p.step === old.step && p.angle === old.angle;
    })) return this.#poses;
    this.#poses = poses.length ? poses : empty;
    return this.#poses;
  }
}
