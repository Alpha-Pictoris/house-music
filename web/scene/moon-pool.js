import { FloorPlan } from "../building/floor-plan.js";
import { quarterTurns } from "../building/furniture-spots.js";
import { InkMesh, instance } from "./ink-mesh.js";

const circle = Math.PI * 2;
const tide = "#78b7bc", foam = "#d5dfbd", gold = "#f1c790";

function shore() {
  const mesh = new InkMesh(0.11);
  const rim = Array.from({ length: 64 }, (_, i) => {
    const a = circle * i / 64;
    const r = 0.94 + 0.023 * Math.sin(3 * a) + 0.025 * Math.cos(7 * a);
    return [r * Math.cos(a), 0, 0.83 * r * Math.sin(a)];
  });
  for (const [scale, y, fill] of [[1, 0, "#677983"], [0.976, 0.001, "#243848"], [0.81, 0.002, "#182c3a"], [0.63, 0.003, "#112330"]]) {
    const ring = rim.map(([x, , z]) => [x * scale, y, z * scale]);
    mesh.face(ring, fill);
  }
  mesh.line(rim.slice(5, 21), foam, 1.15);
  mesh.line(rim.slice(35, 53), tide, 1);
  for (const [x, z, size] of [[-0.55, 0.15, 0.042], [0.28, -0.5, 0.05], [0.45, 0.18, 0.031], [-0.18, -0.33, 0.024], [0.06, 0.58, 0.032]]) {
    mesh.line([[x - size, 0.008, z], [x, 0.008, z - size * 1.5], [x + size, 0.008, z], [x, 0.008, z + size * 1.5]], foam, 0.95, true);
  }
  const moon = (radius, shift, angle) => [-0.19 + shift + radius * Math.cos(angle), 0.01, -0.32 + radius * Math.sin(angle)];
  const outer = [], inner = [];
  for (let i = 0; i <= 18; i++) {
    outer.push(moon(0.13, 0, (0.33 + 1.34 * i / 18) * Math.PI));
    inner.push(moon(0.114, 0.047, (0.45 + 1.1 * i / 18) * Math.PI));
  }
  for (let i = 1; i < outer.length; i++) mesh.face([outer[i-1], outer[i], inner[i], inner[i-1]], "#bccdc4");
  return mesh;
}

function carp(upright = false) {
  const mesh = new InkMesh(0.055);
  const outline = [[0.31,0], [0.23,-0.078], [0.08,-0.12], [-0.12,-0.075], [-0.24,-0.02],
    [-0.43,-0.15], [-0.39,0], [-0.45,0.12], [-0.23,0.022], [-0.08,0.09], [0.11,0.116], [0.25,0.063]];
  const draw = (points, colour, width, closed = false) => mesh.line(points.map(([x,z]) => upright ? [x,z,0] : [x,0,z]), colour, width, closed);
  draw(outline, gold, 1.55, true);
  draw([[0.12,-0.112],[0.067,-0.028],[0.08,0.066]], gold, 1);
  draw([[0.03,0.1],[-0.08,0.19],[-0.13,0.2],[-0.08,0.087]], tide, 1.05);
  draw([[-0.13,-0.07],[-0.19,-0.136],[-0.035,-0.103]], tide, 0.95);
  draw([[0.194,-0.038],[0.212,-0.056],[0.231,-0.037],[0.211,-0.019]], foam, 1, true);
  draw([[-0.26,0],[-0.38,-0.07]], gold, 0.78);
  draw([[-0.44,0.17],[-0.53,0.11],[-0.575,0.028]], tide, 0.78);
  return mesh;
}

function bookplate() {
  const mesh = new InkMesh(0.045);
  const page = [[-0.56,1.97,0.34], [0.47,1.97,0.34], [0.52,1.78,0.35], [0.22,1.79,0.35], [-0.54,1.76,0.35]];
  mesh.face(page, "#5a5958");
  mesh.line(page, "#cebe9e", 0.95, true);
  for (const [left, letters] of [[-0.46, 4], [-0.06, 2], [0.16, 3]]) {
    const line = [[left,1.84,0.36]];
    for (let i = 0; i < letters; i++) {
      const x = left + i * 0.08;
      line.push([x + 0.029,1.86,0.36], [x + 0.046,i % 2 ? 1.92 : 1.89,0.36], [x + 0.026,1.84,0.36], [x + 0.08,1.85,0.36]);
    }
    mesh.line(line, "#eddfbb", 1.05);
  }
  return mesh;
}

function onPiece(mesh, piece, x = 0, y = 0, z = 0, scale = [1, 1, 1]) {
  const box = FloorPlan.footprint(piece), turn = quarterTurns[piece.turn];
  return instance(mesh, { origin: [box.x + box.width / 2 + turn[0]*x + turn[1]*z, y,
    box.z + box.depth / 2 - turn[1]*x + turn[0]*z], scale, turn });
}

export class MoonPool {
  static #bookplate = bookplate();
  static writing(shelf) { return onPiece(this.#bookplate, shelf); }

  #reflection = carp(true);
  #water = shore();
  #fish = carp();

  draw({ mirrors, shelves, pool }, time) {
    const items = shelves.map(shelf => MoonPool.writing(shelf));
    if (!pool) return items;
    for (const mirror of mirrors) {
      const y = 1.46 + 0.26 * Math.sin(time * 0.48);
      for (const side of [-1, 1]) {
        items.push(onPiece(this.#reflection, mirror, 0.08 * Math.cos(time * 0.48), y, side * 0.17, [side * 0.78, 0.78, 1]));
      }
    }
    const { x, z, radius } = pool;
    if (radius <= 0) return items;
    const size = radius * 0.95;
    const water = instance(this.#water, { origin: [x, 0.075, z], scale: [size, 1, size], canvasLayer: 3.05, canvasInkOffset: 0, canvasFlat: true });
    items.push(water);
    for (const [offset, orbit, length] of [[0, 0.43, 0.78], [2.7, 0.32, 0.62], [4.1, 0.53, 0.44]]) {
      const a = time * 0.33 + offset;
      const dx = -Math.sin(a), dz = 0.67 * Math.cos(a), norm = Math.hypot(dx, dz);
      items.push(instance(this.#fish, {
        origin: [x + size * orbit * Math.cos(a), 0.089, z + size * orbit * 0.67 * Math.sin(a)],
        scale: [size * length, 1, size * length], turn: [dx / norm, -dz / norm], canvasLayer: 3.1, canvasInkOffset: 0
      }));
    }
    return items;
  }
}
