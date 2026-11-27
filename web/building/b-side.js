import { furniture } from "./catalogue.js";
import { FloorPlan } from "./floor-plan.js";
import { RoomShape, overlaps, round } from "./room-shape.js";

const home = 0.2;

function gap(a, b) {
  return Math.hypot(Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width), Math.max(0, a.z - b.z - b.depth, b.z - a.z - a.depth));
}

function inside(box, point) {
  return point.x >= box.x && point.x <= box.x + box.width && point.z >= box.z && point.z <= box.z + box.depth;
}

// On the B-side each musical furnishing is a shadow. It stands at the furnishing's feet until it is moved.
export class Shadows {
  static at(piece) {
    return { x: piece.shadow?.x ?? piece.x, z: piece.shadow?.z ?? piece.z };
  }

  static moved(piece, point) {
    const shadow = { x: round(point.x), z: round(point.z) };
    const moved = { ...piece, shadow };
    if (Math.hypot(shadow.x - piece.x, shadow.z - piece.z) < home) delete moved.shadow;
    return moved;
  }
}

// The monitor takes the clearest patch of floor, away from the rug and the furniture.
function standing(room, taken) {
  const size = furniture.monitor, steps = [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6];
  let best = null;
  for (const part of RoomShape.parts(room)) {
    for (const u of steps) for (const v of steps) {
      const box = { x: round(part.x + u * part.width - size.width / 2), z: round(part.z + v * part.depth - size.depth / 2),
        width: size.width, depth: size.depth };
      if (!RoomShape.contains(room, box)) continue;
      const clear = Math.min(1.5, ...taken.map(other => overlaps(box, other) ? -1 : gap(box, other)));
      if (!best || clear > best.clear) best = { clear, x: box.x, z: box.z };
    }
  }
  return best && { x: best.x, z: best.z };
}

export class BSide {
  static monitorId = "monitor on the B-side";
  // How far a rug's shadow stretches past its front and right edges.
  static reach = { x: 0.5, z: 0.4 };
  #cache = new WeakMap();

  // A rug in a room with a lamp has a shadow of its own. The house turns over there.
  static hatches(house) {
    const lit = new Set(house.pieces.filter(piece => furniture[piece.kind].light).map(piece => piece.roomId));
    return house.pieces.filter(piece => piece.kind === "rug" && lit.has(piece.roomId));
  }

  read(house) {
    const saved = this.#cache.get(house);
    if (saved) return saved;
    const hatches = BSide.hatches(house);
    const open = hatches.length > 0;
    const room = house.rooms.find(candidate => hatches.some(rug => rug.roomId === candidate.id));
    const taken = house.pieces.filter(piece => piece.roomId === room?.id && furniture[piece.kind].layer !== "wall");
    const spot = room && standing(room, taken.map(piece => FloorPlan.footprint(piece)));
    const result = {
      open, hatches,
      shadows: open ? house.pieces.filter(piece => FloorPlan.castsShadow(piece)) : [],
      monitor: spot ? { id: BSide.monitorId, kind: "monitor", roomId: room.id, turn: 0, ...spot } : null
    };
    this.#cache.set(house, result);
    return result;
  }

  static hatchAt(side, point, flipped) {
    return side.hatches.find(rug => {
      const box = FloorPlan.footprint(rug);
      if (flipped) return inside(box, point);
      const shadow = { ...box, x: box.x + BSide.reach.x, z: box.z + BSide.reach.z };
      return inside(shadow, point) && !inside(box, point);
    }) ?? null;
  }
}
