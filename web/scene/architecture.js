import {FloorPlan} from '../building/floor-plan.js';
import {InkMesh} from './ink-mesh.js';

const plotHalf = 40;

export function plot() {
  const mesh = new InkMesh(0.8);
  mesh.face(rectangle(-plotHalf, -plotHalf, plotHalf * 2, plotHalf * 2, -0.09), '#1b1422');
  for (let i = -plotHalf; i <= plotHalf; i++) {
    const colour = i === 0 ? '#644b6b' : i % 5 === 0 ? '#462f49' : '#302438';
    mesh.segment([i, -0.085, -plotHalf], [i, -0.085, plotHalf], colour, i === 0 ? 1.1 : 0.69);
    mesh.segment([-plotHalf, -0.085, i], [plotHalf, -0.085, i], colour, i === 0 ? 1.1 : 0.69);
  }
  return mesh;
}

export function originMark() {
  const mesh = new InkMesh();
  const origin = [[0, -0.075, -0.19], [0.19, -0.075, 0], [0, -0.075, 0.19], [-0.19, -0.075, 0]];
  mesh.face(origin, '#292134');
  mesh.line(origin, '#b297bd', 1.25, true);
  return mesh;
}

export function rectangle(x, z, width, depth, y = 0) {
  return [[x, y, z], [x + width, y, z], [x + width, y, z + depth], [x, y, z + depth]];
}

export function roomFloor(room) {
  const {x, z, width, depth} = room;
  const mesh = new InkMesh();
  const palette = ['#332331', '#392633', '#352530', '#3d2936', '#362331'];
  const rows = Math.min(160, Math.ceil(depth / 0.42));
  for (let row = 0; row < rows; row++) {
    const start = z + depth * row / rows;
    const end = z + depth * (row + 1) / rows;
    let plank = 0;
    let left = x;
    while (left < x + width - 0.00001) {
      const right = Math.min(x + width, left + (plank === 0 ? 0.72 + row % 4 * 0.51 : 2.28));
      mesh.face(rectangle(left, start, right - left, end - start), palette[(row * 7 + plank * 3) % palette.length]);
      if (plank) mesh.segment([left, 0, start], [left, 0, end], '#735267', 0.65);
      const length = right - left;
      if (length > 0.6) {
        mesh.line([[left + length * 0.12, 0, start * 0.4 + end * 0.6],
          [left + length * 0.48, 0, start * 0.55 + end * 0.45],
          [left + length * 0.83, 0, start * 0.46 + end * 0.54]], '#624656', 0.46);
      }
      left = right;
      plank++;
    }
    mesh.segment([x, 0, start], [x + width, 0, start], '#725165', 0.78);
  }
  const edge = rectangle(x, z, width, depth);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    mesh.face([a, b, [b[0], -0.088, b[2]], [a[0], -0.088, a[2]]], '#261925');
  }
  mesh.line(edge, '#9d7080', 1.12, true);
  return mesh;
}

export function walls(house) {
  const mesh = new InkMesh();
  const byId = new Map(house.rooms.map(room => [room.id, room]));
  for (const wall of FloorPlan.walls(house)) {
    const {axis, at, start, end, rooms} = wall;
    const room = byId.get(rooms[0]);
    if (!room) continue;
    const shared = rooms.length > 1;
    const back = Math.abs((axis === 'x' ? room.z : room.x) - at) < 0.001;
    const height = shared ? 0.34 : back ? 2.9 : 0.16;
    const length = end - start;
    const centre = back ? 0.025 : -0.025;
    const point = (along, y, normal = centre) => axis === 'x' ? [along, y, at + normal] : [at + normal, y, along];
    const inner = (along, y) => point(along, y, centre + (back ? 0.035 : -0.035));
    const outer = (along, y) => point(along, y, centre + (back ? -0.035 : 0.035));
    mesh.face([inner(start, 0), inner(end, 0), inner(end, height), inner(start, height)], back ? '#39253c' : '#42293c');
    mesh.face([outer(start, 0), outer(end, 0), outer(end, height), outer(start, height)], '#2a1d2e');
    mesh.face([inner(start, height), inner(end, height), outer(end, height), outer(start, height)], '#513148');
    mesh.face([inner(start, 0), outer(start, 0), outer(start, height), inner(start, height)], '#633f57');
    mesh.face([inner(end, 0), outer(end, 0), outer(end, height), inner(end, height)], '#633f57');
    mesh.line([outer(start, 0), outer(start, height), outer(end, height), outer(end, 0)], '#a77591', 1.12);
    mesh.line([inner(start, 0), inner(start, height), inner(end, height), inner(end, 0)], '#bb849d', 1.15);
    if (height < 0.35) continue;
    for (const y of [0.085, 0.19, 0.87, 0.94, height - 0.12]) {
      mesh.segment(inner(start, y), inner(end, y), y === 0.94 ? '#a5748e' : '#77526f', y === 0.94 ? 1.2 : 0.75);
    }
    const panels = Math.max(1, Math.round(length / 1.42));
    for (let i = 0; i < panels; i++) {
      const left = start + length * i / panels + 0.1;
      const right = start + length * (i + 1) / panels - 0.1;
      if (right - left < 0.17) continue;
      mesh.line([inner(left, 0.29), inner(right, 0.29), inner(right, 0.72), inner(left, 0.72)], '#9a6782', 0.73, true);
      if (right - left < 0.63) continue;
      const middle = (left + right) / 2;
      mesh.line([inner(left, 1.09), inner(right, 1.09), inner(right, 2.57),
        inner(middle, 2.71), inner(left, 2.57)], '#755371', 0.69, true);
      mesh.line([inner(middle, 2.19), inner(middle + 0.13, 1.93),
        inner(middle, 1.67), inner(middle - 0.13, 1.93)], '#865d7d', 0.73, true);
    }
  }
  return mesh;
}

export function footprintMark(width, depth, colour, fill) {
  const mesh = new InkMesh();
  const corners = rectangle(0, 0, width, depth, 0.034);
  if (fill) mesh.face(corners, colour);
  mesh.line(corners, colour, 1.5, true);
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    for (const next of [corners[(i + 1) % 4], corners[(i + 3) % 4]]) {
      mesh.segment(corner, corner.map((n, j) => n + (next[j] - n) * Math.min(0.4, 0.16 / (Math.hypot(next[0] - corner[0], next[2] - corner[2]) || 1))), colour, 2.6);
    }
  }
  return mesh;
}

export function doorMark(axis, colour) {
  const mesh = new InkMesh();
  const point = (across, y, inset = 0) => axis === 'x' ? [across, y, inset] : [inset, y, across];
  mesh.line([point(-0.52, 0.035), point(-0.52, 0.74), point(0.52, 0.74), point(0.52, 0.035)], colour, 1.7);
  mesh.segment(point(-0.52, 0.035), point(0.52, 0.035), colour, 1.15);
  mesh.line([point(-0.52, 0.035), point(-0.44, 0.035, 0.27), point(-0.22, 0.035, 0.46), point(0.04, 0.035, 0.52)], colour, 0.85);
  return mesh;
}
