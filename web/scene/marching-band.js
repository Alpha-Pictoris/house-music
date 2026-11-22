import { BandFloor } from './band-floor.js';

const instruments = ['trombone', 'drum', 'sousaphone'];
const empty = [];
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function offstage(camera, gate) {
  const start = camera.project([gate.x, 0, gate.z]);
  const next = camera.project([gate.x + gate.dx, 0, gate.z + gate.dz]);
  const margin = camera.scale * 2.1 + 6;
  const edge = (at, velocity, size) => Math.abs(velocity) < 0.0001 ? Infinity :
    ((velocity > 0 ? size + margin : -margin) - at) / velocity;
  const distance = Math.max(0, Math.min(edge(start.x, next.x - start.x, camera.width), edge(start.y, next.y - start.y, camera.height))) + 0.25;
  return { x: gate.x + distance * gate.dx, z: gate.z + distance * gate.dz };
}

class Musician {
  path = [];
  visit = 0;
  waiting = 0;
  gone = false;

  constructor(index, floor, camera, settled) {
    this.index = index;
    this.angle = 0.5 + index * 0.36;
    this.gate = floor.gates[index];
    const start = settled ? floor.destinations(index, 0).find(p => floor.path(this.gate, p)) ?? this.gate : offstage(camera, this.gate);
    this.x = start.x;
    this.z = start.z;
    this.visit = settled ? 1 : 0;
  }

  turn(floor, camera, enabled) {
    this.path = [];
    this.waiting = 0;
    if (enabled) {
      if (this.gone) {
        const start = offstage(camera, this.gate);
        this.x = start.x;
        this.z = start.z;
        this.gone = false;
      }
      return;
    }
    if (this.gone) return;
    const gates = [...floor.gates].sort((a, b) => gap(this, a) - gap(this, b));
    for (const gate of gates) {
      const end = offstage(camera, gate);
      const path = floor.path(this, end);
      if (!path) continue;
      this.gate = gate;
      this.path = path;
      return;
    }
  }

  #wander(floor, reserved) {
    const stops = floor.destinations(this.index, this.visit++);
    const available = stop => gap(this, stop) > 0.45 && reserved.every(p => gap(stop, p) > 0.5);
    for (const stop of stops.filter(available)) {
      const path = floor.path(this, stop);
      if (path) { this.path = path; return; }
    }
    this.waiting = 0.65;
  }

  #walk(dt, speed) {
    let remaining = dt * speed;
    while (this.path.length && remaining > 0) {
      const next = this.path[0], dx = next.x - this.x, dz = next.z - this.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-6) { this.path.shift(); continue; }
      const travel = Math.min(remaining, distance);
      this.x += dx / distance * travel;
      this.z += dz / distance * travel;
      const angle = Math.atan2(dx, dz) - this.angle;
      this.angle += Math.atan2(Math.sin(angle), Math.cos(angle)) * Math.min(1, dt * 9);
      remaining -= travel;
      if (travel === distance) this.path.shift();
    }
  }

  step(floor, camera, enabled, dt, music, reduced, reserved) {
    if (this.gone) return null;
    let action = 'idle', pose = 0;
    if (music !== null) {
      const period = [11, 16, 13][this.index];
      const kick = (music + period - [3, 7, 5][this.index]) % period;
      const indoors = floor.groundAt(this) > 0;
      if (enabled && !reduced && indoors && kick >= 0 && kick < 1) {
        action = 'kick';
        pose = Math.min(11, Math.floor(kick * 12));
      } else {
        this.waiting = Math.max(0, this.waiting - dt);
        if (enabled && !this.path.length && !this.waiting) this.#wander(floor, reserved);
        if (!enabled && !this.path.length) {
          const end = offstage(camera, this.gate);
          if (gap(this, end) < 0.3) { this.gone = true; return null; }
          this.turn(floor, camera, false);
        }
        if (this.path.length) {
          const speed = indoors ? 0.90 + this.index * 0.13 : Math.max(2.3, 0.15 * camera.width / camera.scale);
          this.#walk(dt, speed);
          if (enabled && !this.path.length) this.waiting = 0.6 + this.index * 0.3;
          action = 'walk';
          pose = Math.floor(((music * 0.5 + this.index * 0.19) % 1) * (reduced ? 4 : 12)) * (reduced ? 3 : 1);
        } else if (enabled && !reduced) {
          action = 'sway';
          pose = Math.floor(((music * 0.5 + this.index * 0.19) % 1) * 12);
        }
      }
    }
    return { instrument: instruments[this.index], x: this.x, z: this.z, angle: this.angle,
      ground: floor.groundAt(this), action, step: pose };
  }
}

export class MarchingBand {
  #layout;
  #floor;
  #players = [];
  #poses = empty;
  #time;
  #phase = null;
  #music = 0;
  #enabled;
  #settled;

  constructor(settled = false) { this.#settled = settled; }

  frame(house, camera, time, beat, reduced = false) {
    const enabled = house.band !== false && house.rooms.length > 0;
    const layout = this.#layout;
    const edited = !layout || house.rooms !== layout.rooms || house.doors !== layout.doors || house.pieces !== layout.pieces;
    const switched = enabled !== this.#enabled;
    const paused = beat === null;
    if (!edited && !switched && paused && this.#phase === null) return this.#poses;
    if (!edited && !switched && !paused && this.#phase !== null && time - this.#time < 1 / 15) return this.#poses;
    const dt = this.#phase === null || paused ? 0 : Math.max(0, Math.min(0.4, time - this.#time));
    this.#time = time;
    if (!paused && this.#phase !== null) this.#music += (beat % 4 - this.#phase + 4) % 4;
    this.#phase = paused ? null : beat % 4;
    this.#enabled = enabled;
    this.#layout = house;
    if (edited && house.rooms.length) this.#floor = new BandFloor(house);
    if (!this.#floor) return empty;
    if (!this.#players.length && enabled) {
      this.#players = instruments.map((_, i) => new Musician(i, this.#floor, camera, this.#settled));
      this.#settled = false;
    }
    if (edited || switched) {
      for (const player of this.#players) player.turn(this.#floor, camera, enabled);
    }
    const poses = [];
    for (const player of this.#players) {
      const reserved = this.#players.filter(other => other !== player && !other.gone).map(other => other.path.at(-1) ?? other);
      const pose = player.step(this.#floor, camera, enabled, dt, paused ? null : this.#music, reduced, reserved);
      if (pose) poses.push(pose);
    }
    if (!poses.length) this.#players = [];
    this.#poses = poses.length ? poses : empty;
    return this.#poses;
  }
}
