import { furniture } from "./catalogue.js";

const epsilon = 0.00001;
const round = value => Math.round(value * 1000) / 1000;
const overlaps = (a, b) => a.x < b.x + b.width - epsilon && b.x < a.x + a.width - epsilon
  && a.z < b.z + b.depth - epsilon && b.z < a.z + a.depth - epsilon;
const inside = (room, box) => box.x >= room.x - epsilon && box.z >= room.z - epsilon
  && box.x + box.width <= room.x + room.width + epsilon && box.z + box.depth <= room.z + room.depth + epsilon;

function snap(value, edges) {
  let distance = 0.2;
  let snapped = value;
  for (const edge of edges) {
    const difference = Math.abs(value - edge);
    if (difference < distance) { distance = difference; snapped = edge; }
  }
  return round(snapped);
}

export class FloorPlan {
  static roomBetween(house, start, end) {
    const xs = house.rooms.flatMap(room => [room.x, room.x + room.width]);
    const zs = house.rooms.flatMap(room => [room.z, room.z + room.depth]);
    const x1 = snap(start.x, xs), x2 = snap(end.x, xs);
    const z1 = snap(start.z, zs), z2 = snap(end.z, zs);
    return { x: Math.min(x1, x2), z: Math.min(z1, z2), width: round(Math.abs(x2 - x1)), depth: round(Math.abs(z2 - z1)) };
  }

  static roomError(house, room) {
    if (![room.x, room.z, room.width, room.depth].every(Number.isFinite)) return "Choose two points on the plot.";
    if (room.width < 2 || room.depth < 2) return "Draw a room at least two units wide and deep.";
    if ([room.x, room.z, room.x + room.width, room.z + room.depth].some(n => Math.abs(n) > 256)) return "Draw closer to the centre of the plot.";
    if (house.rooms.some(other => other.id !== room.id && overlaps(other, room))) return "Place the new room beside the existing walls.";
    return "";
  }

  static footprint(piece) {
    const item = furniture[piece.kind];
    const sideways = piece.turn % 2 === 1;
    return { x: piece.x, z: piece.z, width: sideways ? item.depth : item.width, depth: sideways ? item.width : item.depth };
  }

  static roomAt(house, point) {
    return house.rooms.find(room => inside(room, { ...point, width: 0, depth: 0 }));
  }

  static roomFor(house, piece) {
    const box = FloorPlan.footprint(piece);
    return house.rooms.find(room => inside(room, box));
  }

  static pieceError(house, piece) {
    const box = FloorPlan.footprint(piece);
    const room = house.rooms.find(candidate => candidate.id === piece.roomId);
    if (!room || !inside(room, box)) return "Place the whole piece inside a room.";
    if (house.pieces.some(other => other.id !== piece.id && overlaps(box, FloorPlan.footprint(other)))) {
      return "Leave enough space between the pieces.";
    }
    return "";
  }

  static wallSpans(house) {
    const lines = new Map();
    function edge(axis, coordinate, start, end, id) {
      const at = round(coordinate);
      const key = axis + ":" + at;
      if (!lines.has(key)) lines.set(key, { axis, at, edges: [] });
      lines.get(key).edges.push({ start: round(start), end: round(end), id });
    }
    for (const { x, z, width, depth, id } of house.rooms) {
      edge("x", z, x, x + width, id);
      edge("x", z + depth, x, x + width, id);
      edge("z", x, z, z + depth, id);
      edge("z", x + width, z, z + depth, id);
    }
    const spans = [];
    for (const { axis, at, edges } of lines.values()) {
      const cuts = [...new Set(edges.flatMap(e => [e.start, e.end]))].sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i - 1], end = cuts[i];
        const rooms = edges.filter(e => e.start <= start && e.end >= end).map(e => e.id);
        if (rooms.length) spans.push({ axis, at, start, end, rooms });
      }
    }
    return spans;
  }

  static doorAt(house, point, tolerance = 0.6) {
    if (![point.x, point.z].every(Number.isFinite)) return null;
    let best = null, nearest = tolerance;
    for (const wall of FloorPlan.wallSpans(house)) {
      if (wall.rooms.length !== 2 || wall.end - wall.start < 1 - epsilon) continue;
      const along = wall.axis === "x" ? point.x : point.z;
      const across = wall.axis === "x" ? point.z : point.x;
      const centre = round(Math.max(wall.start + 0.5, Math.min(wall.end - 0.5, along)));
      const distance = Math.hypot(across - wall.at, centre - along);
      if (distance > nearest) continue;
      nearest = distance;
      best = { rooms: wall.rooms, axis: wall.axis, x: wall.axis === "x" ? centre : wall.at, z: wall.axis === "z" ? centre : wall.at };
    }
    return best;
  }

  static doorError(house, door) {
    const wall = FloorPlan.doorAt(house, door, epsilon);
    if (!wall || door.rooms.length !== 2 || !wall.rooms.every(id => door.rooms.includes(id))) return "Choose a shared wall with room for a doorway.";
    const collision = house.doors.some(other => other.id !== door.id && wall.rooms.every(id => other.rooms.includes(id))
      && Math.hypot(other.x - door.x, other.z - door.z) < 1 - epsilon);
    return collision ? "Leave space for this doorway." : "";
  }

  static walls(house) {
    return FloorPlan.wallSpans(house).flatMap(wall => {
      const openings = house.doors.filter(door => wall.rooms.length === 2 && wall.rooms.every(id => door.rooms.includes(id)))
        .map(door => wall.axis === "x" ? door.x : door.z).sort((a, b) => a - b);
      const parts = [];
      let start = wall.start;
      for (const centre of openings) {
        if (centre - 0.5 > start + epsilon) parts.push({ ...wall, start, end: centre - 0.5 });
        start = centre + 0.5;
      }
      if (start < wall.end - epsilon) parts.push({ ...wall, start });
      return parts;
    });
  }
}
