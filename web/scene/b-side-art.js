import {RoomShape} from '../building/room-shape.js';
import {rectangle} from './architecture.js';
import {panel} from './domestic-art.js';
import {InkMesh} from './ink-mesh.js';

export function rugShadow(width, depth) {
  const mesh = new InkMesh();
  const c = 0.11;
  mesh.face([[c, 0, 0], [width - c, 0, 0], [width, 0, c], [width, 0, depth - c],
    [width - c, 0, depth], [c, 0, depth], [0, 0, depth - c], [0, 0, c]], '#140d1b');
  return mesh;
}

export function undersideFloor(room) {
  const mesh = new InkMesh();
  for (const {x, z, width, depth} of RoomShape.parts(room)) {
    mesh.face(rectangle(x, z, width, depth), '#17111f');
    const joists = Math.max(1, Math.round(width / 0.8));
    for (let i = 1; i < joists; i++) {
      const at = x + width * i / joists;
      mesh.segment([at, 0.002, z + 0.06], [at, 0.002, z + depth - 0.06], '#33263f', 0.8);
    }
  }
  for (const {axis, at, start, end} of RoomShape.walls([room])) {
    const [a, b] = [start, end].map(along => axis === 'x' ? [along, 0, at] : [at, 0, along]);
    mesh.face([a, b, [b[0], -0.064, b[2]], [a[0], -0.064, a[2]]], '#120d18');
    mesh.segment(a, b, '#8f7aa8', 1.2);
  }
  return mesh;
}

export function rugUnderside(width, depth) {
  const mesh = new InkMesh();
  mesh.face(rectangle(0, 0, width, depth, 0.004), '#2c1c2e');
  mesh.line(rectangle(0.05, 0.05, width - 0.1, depth - 0.1, 0.006), '#a8748c', 1.1, true);
  for (let x = 0.22; x < width - 0.1; x += 0.24) mesh.segment([x, 0.006, 0.09], [x, 0.006, depth - 0.09], '#5b3b52', 0.7);
  return mesh;
}

export function monitor({box, shape, line, segment}) {
  const shell = '#55554c', shade = '#414139', trim = '#c8c4a6', dim = '#8d8b74';
  box(-0.44, 0.02, -0.38, 0.44, 0.17, 0.4, shade, dim, 0.9);
  for (const x of [-0.3, -0.18, -0.06, 0.06, 0.18]) segment([x, 0.172, 0.24], [x + 0.08, 0.172, 0.24], dim, 0.7);
  box(-0.1, 0.17, -0.12, 0.1, 0.25, 0.1, shade, dim, 0.8);
  box(-0.42, 0.25, -0.36, 0.42, 1.08, 0.3, shell, trim, 1.2);
  shape(panel(-0.34, 0.36, 0.68, 0.62, 0.304), '#0b1210', '#9fb295', 1.25);
  line(panel(-0.3, 0.4, 0.6, 0.54, 0.308), '#33443a', 0.8, true);
  line([[-0.26, 0.9, 0.31], [-0.12, 0.93, 0.31], [0.05, 0.92, 0.31]], '#4a5c4e', 0.7);
  for (const x of [-0.22, -0.11, 0, 0.11, 0.22]) segment([x, 1.082, -0.26], [x, 1.082, 0.12], dim, 0.7);
  segment([0.3, 0.31, 0.304], [0.36, 0.31, 0.304], trim, 1.3);
}

export function phosphor() {
  const mesh = new InkMesh(0.02);
  const dot = Array.from({length: 10}, (_, i) => {
    const angle = i * Math.PI / 5;
    return [0.034 * Math.cos(angle), 0.67 + 0.034 * Math.sin(angle), 0.312];
  });
  mesh.face(dot, '#9dff8a');
  mesh.line(dot, '#d6ffc4', 0.9, true);
  mesh.segment([-0.2, 0.67, 0.312], [0.2, 0.67, 0.312], '#58c96a', 0.75);
  return mesh;
}
