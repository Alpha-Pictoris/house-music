import { furniture } from "./catalogue.js";
import { FloorPlan } from "./floor-plan.js";
import { RoomShape } from "./room-shape.js";

const floorSamples = [0.5, 0.3, 0.7, 0.15, 0.85];
const offerings = ["bottle", "bell", "grimoire"];

function waterline(room, pieces) {
  const footprints = pieces.filter(piece => !furniture[piece.kind].layer).map(piece => FloorPlan.footprint(piece));
  let best;
  for (const part of RoomShape.parts(room)) {
    for (const u of floorSamples) {
      for (const v of floorSamples) {
        const x = part.x + u * part.width, z = part.z + v * part.depth;
        const edge = Math.min(u, 1 - u) * part.width;
        const end = Math.min(v, 1 - v) * part.depth;
        const radius = Math.min(2.4, edge, end, ...footprints.map(box => Math.hypot(
          Math.max(0, box.x - x, x - box.x - box.width),
          Math.max(0, box.z - z, z - box.z - box.depth)
        )));
        if (!best || radius > best.radius) best = { x, z, radius };
      }
    }
  }
  return best;
}

export class LookingGlass {
  #cache = new WeakMap();

  read(house) {
    const saved = this.#cache.get(house);
    if (saved) return saved;
    const rooms = new Map();
    for (const piece of house.pieces) {
      if (!piece.roomId) continue;
      if (!rooms.has(piece.roomId)) rooms.set(piece.roomId, []);
      rooms.get(piece.roomId).push(piece);
    }

    const writing = new Map(), discoveries = [];
    for (const room of house.rooms) {
      const pieces = rooms.get(room.id);
      const mirrors = pieces?.filter(piece => piece.kind === "mirror");
      if (!mirrors?.length) continue;
      const shelves = pieces.filter(piece => piece.kind === "bookcase");
      if (!shelves.length) continue;
      const answered = shelf => offerings.every((kind, slot) =>
        shelf.contents?.some(item => item.slot === slot && item.kind === kind));
      const awake = shelves.find(answered);
      const discovery = { room, mirrors, shelves, shelf: awake ?? shelves[0], pool: awake ? waterline(room, pieces) : null };
      for (const shelf of shelves) writing.set(shelf.id, discovery);
      discoveries.push(discovery);
    }
    const result = { writing, discoveries };
    this.#cache.set(house, result);
    return result;
  }
}
