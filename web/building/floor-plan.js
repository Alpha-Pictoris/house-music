import { furniture } from "./catalogue.js";

import { RoomShape, overlaps, round, tolerance as epsilon } from "./room-shape.js";

function touchesWindow(door, piece) {
  const opening = FloorPlan.windowOpening(piece);
  const along = opening.axis === "x" ? door.x : door.z;
  const across = opening.axis === "x" ? door.z : door.x;
  return Math.abs(across - opening.at) < epsilon && along + 0.5 > opening.start + epsilon && along - 0.5 < opening.end - epsilon;
}

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
    const sections = house.rooms.flatMap(room => RoomShape.parts(room));
    const xs = sections.flatMap(room => [room.x, room.x + room.width]);
    const zs = sections.flatMap(room => [room.z, room.z + room.depth]);
    const x1 = snap(start.x, xs), x2 = snap(end.x, xs);
    const z1 = snap(start.z, zs), z2 = snap(end.z, zs);
    return { x: Math.min(x1, x2), z: Math.min(z1, z2), width: round(Math.abs(x2 - x1)), depth: round(Math.abs(z2 - z1)) };
  }

  static planRoom(house, start, end) {
    const addition = FloorPlan.roomBetween(house, start, end);
    const owner = house.rooms.find(room => RoomShape.parts(room).some(part => overlaps(part, addition)))
      ?? house.rooms.find(room => RoomShape.interior(room, start) || RoomShape.interior(room, end));
    if (!owner) return { room: addition, error: FloorPlan.roomError(house, addition) };
    if (!RoomShape.validBox(addition) || Math.min(addition.width, addition.depth) < 0.5) {
      return { room: addition, error: "Draw a wider extension within the plot." };
    }
    if (RoomShape.contains(owner, addition)) return { room: owner, error: "Draw past the wall to extend this room." };
    const sections = [...RoomShape.parts(owner), addition];
    if (!RoomShape.connected(sections)) return { room: addition, error: "Join the extension along a wall." };
    const shape = RoomShape.union(sections);
    const room = { ...owner, ...shape };
    if (!shape.sections) delete room.sections;
    return { room, error: FloorPlan.roomError(house, room) };
  }

  static roomError(house, room) {
    if (![room.x, room.z, room.width, room.depth].every(Number.isFinite)) return "Choose two points on the plot.";
    if (room.width < 2 || room.depth < 2) return "Draw a room at least two units wide and deep.";
    if (!RoomShape.validBox(room)) return "Draw closer to the centre of the plot.";
    const parts = RoomShape.parts(room);
    if (house.rooms.some(other => other.id !== room.id && RoomShape.parts(other).some(a => parts.some(b => overlaps(a,b))))) {
      return "Leave the neighbouring room its own floor.";
    }
    if (house.pieces.some(piece => furniture[piece.kind].garden && parts.some(part => overlaps(part, FloorPlan.footprint(piece))))) {
      return "Move the garden pieces before building here.";
    }
    const expanded = { ...house, rooms: [...house.rooms.filter(other => other.id !== room.id), room] };
    if (house.pieces.some(piece => furniture[piece.kind].layer === "wall" && !FloorPlan.windowFits(expanded, piece))) {
      return "Move the window before extending its wall.";
    }
    if (house.doors.some(door => !FloorPlan.doorAt(expanded, door, epsilon) && !FloorPlan.opensIntoRoom(house, room, door))) {
      return "Leave room for the existing doorway.";
    }
    return "";
  }

  static opensIntoRoom(house, room, door) {
    if (door.rooms.length !== 1 || door.rooms[0] !== room.id) return false;
    const wall = FloorPlan.doorAt(house, door, epsilon);
    if (!wall) return false;
    const dx = wall.axis === "x" ? 0.5 : 0.01, dz = wall.axis === "x" ? 0.01 : 0.5;
    return RoomShape.contains(room, { x: door.x - dx, z: door.z - dz, width: 2*dx, depth: 2*dz });
  }

  static footprint(piece) {
    const item = furniture[piece.kind];
    const sideways = piece.turn % 2 === 1;
    return { x: piece.x, z: piece.z, width: sideways ? item.depth : item.width, depth: sideways ? item.width : item.depth };
  }

  static roomAt(house, point) {
    return house.rooms.find(room => RoomShape.at(room, point));
  }

  static roomFor(house, piece) {
    const box = FloorPlan.footprint(piece);
    return house.rooms.find(room => RoomShape.contains(room, box));
  }

  static pieceError(house, piece) {
    const box = FloorPlan.footprint(piece);
    const item = furniture[piece.kind];
    if (item.layer === "surface") return "Choose a surface for this object.";
    if (![box.x, box.z, box.x + box.width, box.z + box.depth].every(n => Number.isFinite(n) && Math.abs(n) <= 256)) {
      return "Choose a spot on the plot.";
    }
    const room = house.rooms.find(candidate => candidate.id === piece.roomId);
    if (item.garden) {
      if (piece.roomId !== null || house.rooms.some(candidate => RoomShape.parts(candidate).some(part => overlaps(box, part)))) return "Place this piece in the garden.";
    } else if (item.layer === "wall") {
      if (!room || !FloorPlan.windowFits(house, piece)) return "Choose an outside wall for the window.";
      if (house.doors.some(door => touchesWindow(door, piece))) return "Leave the doorway open.";
    } else if (!room || !RoomShape.contains(room, box)) return "Place the whole piece inside a room.";
    if (house.pieces.some(other => other.id !== piece.id && furniture[other.kind].layer === item.layer && overlaps(box, FloorPlan.footprint(other)))) {
      return "Leave enough space between the pieces.";
    }
    return "";
  }

  static windowAt(house, point, reach = 0.85) {
    let nearest = null;
    const { width, depth } = furniture.window;
    for (const wall of FloorPlan.wallSpans(house)) {
      if (wall.rooms.length !== 1 || wall.end - wall.start < width - epsilon) continue;
      const room = house.rooms.find(item => item.id === wall.rooms[0]);
      const horizontal = wall.axis === "x";
      const back = wall.back;
      const along = horizontal ? point.x : point.z;
      const start = round(Math.max(wall.start, Math.min(wall.end - width, along - width / 2)));
      const distance = Math.hypot((horizontal ? point.z : point.x) - wall.at, along - start - width / 2);
      if (distance > reach || (nearest && nearest.distance <= distance)) continue;
      const edge = round(wall.at - (back ? 0 : depth));
      nearest = { distance, placement: { x: horizontal ? start : edge, z: horizontal ? edge : start,
        roomId: room.id, turn: horizontal ? (back ? 0 : 2) : (back ? 1 : 3) } };
    }
    return nearest?.placement ?? null;
  }

  static windowOpening(piece) {
    const { x, z, width, depth } = FloorPlan.footprint(piece);
    if (piece.turn % 2 === 0) return { axis: "x", at: piece.turn === 0 ? z : z + depth, start: x, end: x + width };
    return { axis: "z", at: piece.turn === 1 ? x : x + width, start: z, end: z + depth };
  }

  static windowFits(house, piece) {
    const box = FloorPlan.footprint(piece);
    const point = { x: box.x + box.width / 2, z: box.z + box.depth / 2 };
    const wall = FloorPlan.windowAt(house, point);
    return wall?.roomId === piece.roomId && wall.turn === piece.turn &&
      Math.abs(wall.x - piece.x) < epsilon && Math.abs(wall.z - piece.z) < epsilon;
  }

  static wallSpans(house) { return RoomShape.walls(house.rooms); }

  static doorAt(house, point, tolerance = 0.6) {
    if (![point.x, point.z].every(Number.isFinite)) return null;
    let best = null, nearest = tolerance;
    for (const wall of FloorPlan.wallSpans(house)) {
      if (wall.end - wall.start < 1 - epsilon) continue;
      const along = wall.axis === "x" ? point.x : point.z;
      const across = wall.axis === "x" ? point.z : point.x;
      const centre = round(Math.max(wall.start + 0.5, Math.min(wall.end - 0.5, along)));
      const distance = Math.hypot(across - wall.at, centre - along);
      if (distance > nearest) continue;
      nearest = distance;
      best = { rooms: wall.rooms, axis: wall.axis, back: wall.back, x: wall.axis === "x" ? centre : wall.at, z: wall.axis === "z" ? centre : wall.at };
    }
    return best;
  }

  static doorError(house, door) {
    const wall = FloorPlan.doorAt(house, door, epsilon);
    if (!wall || door.rooms.length !== wall.rooms.length || !wall.rooms.every(id => door.rooms.includes(id))) return "Choose a wall with room for a doorway.";
    if (house.pieces.some(piece => furniture[piece.kind].layer === "wall" && touchesWindow(door, piece))) return "Leave space for the window.";
    const collision = house.doors.some(other => other.id !== door.id && wall.rooms.every(id => other.rooms.includes(id))
      && Math.hypot(other.x - door.x, other.z - door.z) < 1 - epsilon);
    return collision ? "Leave space for this doorway." : "";
  }

  static walls(house) {
    return FloorPlan.wallSpans(house).flatMap(wall => {
      const openings = house.doors.filter(door => door.rooms.length === wall.rooms.length && wall.rooms.every(id => door.rooms.includes(id))
        && Math.abs((wall.axis === "x" ? door.z : door.x) - wall.at) < epsilon
        && (wall.axis === "x" ? door.x : door.z) >= wall.start && (wall.axis === "x" ? door.x : door.z) <= wall.end)
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
