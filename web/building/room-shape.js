export const tolerance = 0.00001;
export const round = value => Math.round(value * 1000) / 1000;

function intersection(a, b) {
  return [
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    Math.min(a.z + a.depth, b.z + b.depth) - Math.max(a.z, b.z)
  ];
}

export function overlaps(a, b) {
  return intersection(a, b).every(length => length > tolerance);
}

export class RoomShape {
  static parts(room) { return room.sections ?? [room]; }

  static validBox(box) {
    return box && [box.x, box.z, box.width, box.depth].every(Number.isFinite)
      && box.width > 0 && box.depth > 0
      && [box.x, box.z, box.x + box.width, box.z + box.depth].every(n => Math.abs(n) <= 256);
  }

  static at(room, point) {
    return this.parts(room).some(r => point.x >= r.x - tolerance && point.x <= r.x + r.width + tolerance
      && point.z >= r.z - tolerance && point.z <= r.z + r.depth + tolerance);
  }

  static interior(room, point) {
    const margin = tolerance * 3;
    return [-margin, margin].every(dx => [-margin, margin].every(dz =>
      this.at(room, { x: point.x + dx, z: point.z + dz })));
  }

  static contains(room, box) {
    let area = 0;
    for (const part of this.parts(room)) {
      const [dx, dz] = intersection(part, box);
      area += Math.max(0, dx) * Math.max(0, dz);
    }
    return box.width * box.depth - area <= tolerance * (box.width + box.depth);
  }

  static connected(parts) {
    const seen = new Set([parts[0]]);
    for (const part of seen) {
      for (const next of parts) {
        if (seen.has(next)) continue;
        const [x, z] = intersection(part, next);
        if (Math.min(x, z) >= -tolerance && Math.max(x, z) > tolerance) seen.add(next);
      }
    }
    return seen.size === parts.length;
  }

  static union(parts) {
    const columns = [...new Set(parts.flatMap(r => [r.x, round(r.x + r.width)]))].sort((a,b) => a-b);
    const sections = [];
    let previous = new Map();
    for (let i = 1; i < columns.length; i++) {
      const x = columns[i-1], right = columns[i], spans = [];
      const covering = parts.filter(r => r.x <= x && round(r.x + r.width) >= right).sort((a,b) => a.z-b.z);
      for (const r of covering) {
        const front = round(r.z + r.depth), last = spans.at(-1);
        if (last && last[1] >= r.z) last[1] = Math.max(last[1], front);
        else spans.push([r.z, front]);
      }
      const next = new Map();
      for (const [z, front] of spans) {
        const key = z + "/" + front;
        const rect = previous.get(key) ?? { x, z, depth: round(front - z) };
        if (!previous.has(key)) sections.push(rect);
        rect.width = round(right - rect.x);
        next.set(key, rect);
      }
      previous = next;
    }
    if (sections.length === 1) return sections[0];
    const x = columns[0], z = Math.min(...parts.map(r => r.z));
    return { x, z, width: round(columns.at(-1) - x), depth: round(Math.max(...parts.map(r => r.z + r.depth)) - z), sections };
  }

  static walls(rooms) {
    const lines = new Map();
    function edge(axis, coordinate, start, end, id, direction) {
      const at = round(coordinate), key = axis + "/" + at;
      if (!lines.has(key)) lines.set(key, { axis, at, edges: [] });
      lines.get(key).edges.push({ start: round(start), end: round(end), id, direction });
    }
    for (const room of rooms) for (const {x,z,width,depth} of this.parts(room)) {
      edge("x", z, x, x + width, room.id, 1);
      edge("x", z + depth, x, x + width, room.id, -1);
      edge("z", x, z, z + depth, room.id, 1);
      edge("z", x + width, z, z + depth, room.id, -1);
    }
    const walls = [];
    for (const {axis, at, edges} of lines.values()) {
      const cuts = [...new Set(edges.flatMap(e => [e.start, e.end]))].sort((a,b) => a-b);
      for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i-1], end = cuts[i], sides = new Map();
        for (const e of edges) if (e.start <= start && e.end >= end) sides.set(e.id, (sides.get(e.id) ?? 0) + e.direction);
        const owners = [...sides.keys()].filter(id => sides.get(id));
        if (!owners.length) continue;
        const back = sides.get(owners[0]) > 0, last = walls.at(-1);
        if (last?.axis === axis && last.at === at && last.end === start && last.back === back
            && last.rooms.length === owners.length && owners.every((id,j) => last.rooms[j] === id)) last.end = end;
        else walls.push({ axis, at, start, end, rooms: owners, back });
      }
    }
    return walls;
  }
}
