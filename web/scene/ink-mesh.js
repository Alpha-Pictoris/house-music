export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

export class InkMesh {
  constructor(sampleDistance = 0.125) {
    this.sampleDistance = sampleDistance;
  }

  surfaces = [];
  strokes = [];
  commands = [];

  face = (points, colour) => {
    this.commands.push({points, colour});
    const rgb = channels(colour);
    for (let i = 2; i < points.length; i++) {
      this.surfaces.push(...points[0], ...rgb, ...points[i - 1], ...rgb, ...points[i], ...rgb);
    }
  };

  line = (points, colour, width = 1, closed = false) => {
    const samples = [points[0]];
    const knots = closed ? [...points, points[0]] : points;
    for (let i = 1; i < knots.length; i++) {
      const start = knots[i - 1];
      const delta = knots[i].map((n, j) => n - start[j]);
      const steps = Math.ceil(Math.hypot(...delta) / this.sampleDistance);
      for (let j = 1; j <= steps; j++) samples.push(start.map((n, k) => n + delta[k] * j / steps));
    }
    if (samples.length < 2) return;
    this.commands.push({points: samples, colour, width});
    const rgb = channels(colour);
    const pairs = samples.map((point, i) => {
      const previous = samples[i - 1] ?? (closed ? samples.at(-2) : point);
      const next = samples[i + 1] ?? (closed ? samples[1] : point);
      const delta = next.map((n, j) => n - previous[j]);
      const length = Math.hypot(...delta) || 1;
      const vertex = [...point, ...rgb, ...delta.map(n => n / length)];
      return [[...vertex, -1, width], [...vertex, 1, width]];
    });
    for (let i = 1; i < pairs.length; i++) {
      const [a, b] = pairs[i - 1], [c, d] = pairs[i];
      this.strokes.push(...a, ...b, ...c, ...c, ...b, ...d);
    }
  };

  segment = (a, b, colour, width) => this.line([a, b], colour, width);
}

export function channels(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

export function transformPoint([x, y, z], item) {
  const [width, height, depth] = item.scale;
  const [tx, ty, tz] = item.origin;
  const [cos, sin] = item.turn;
  const level = item.level * item.pose;
  x *= width;
  y *= height;
  z *= depth;
  if (item.voice === 1) x += level * 0.13 * smooth((y - 0.16) / 2.9);
  if (item.voice === 2) z += level * 0.075 * y;
  if (item.voice === 3) y += level * 0.095 * smooth((y - 1.3) / 0.9);
  return [cos * x + sin * z + tx, y + ty, -sin * x + cos * z + tz];
}

function smooth(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export const instance = (mesh, options = {}) => ({
  mesh, scale: [1, 1, 1], origin: [0, 0, 0], turn: [1, 0],
  level: 0, pose: 1, voice: 0, opacity: 1, wobble: 1, catchesSweep: true, tint: [0, 0, 0], tintAmount: 0, ...options
});
