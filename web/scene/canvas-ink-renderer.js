import {channels, dot, transformPoint, translucentItems} from './ink-mesh.js';
import {InkRaster} from './ink-raster.js';

function pigment(colour, item, brightness = 1) {
  return channels(colour).map((channel, i) => {
    const value = channel + (item.tint[i] - channel) * item.tintAmount;
    return Math.min(255, Math.round(255 * value * brightness));
  });
}

export class CanvasInkRenderer {
  raster = new InkRaster();

  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(canvas, camera, items, frame) {
    const {raster} = this;
    raster.clear(this.ctx, canvas.width, canvas.height);
    const sx = canvas.width / camera.width, sy = canvas.height / camera.height;
    const project = (world, wobble = 0) => {
      let {x, y} = camera.project(world);
      if (wobble) {
        const a = dot(world, [5.7, 7.1, 4.9]), b = dot(world, [-7.6, 4.2, 6.3]), d = frame.drawing;
        x += wobble * (0.64 * Math.sin(a + d) + 0.36 * Math.sin(2.6 * b - 0.8 * d));
        y -= wobble * (0.64 * Math.sin(b - 1.3 * d) + 0.36 * Math.sin(2.3 * a + 1.7 * d));
      }
      return {x: x * sx, y: y * sy, z: dot(world, camera.eye)};
    };
    for (const item of items) if (item.opacity === 1) this.#faces(item, project);
    for (const item of translucentItems(items, camera.eye)) this.#faces(item, project);
    for (const item of items) this.#ink(item, project, sx, frame.wobble);
    this.ctx.putImageData(raster.image, 0, 0);
  }

  #faces(item, project) {
    for (const {points, colour, width} of item.mesh.commands) {
      if (width) continue;
      const rgb = pigment(colour, item);
      const first = project(transformPoint(points[0], item));
      let previous = project(transformPoint(points[1], item));
      for (let i = 2; i < points.length; i++) {
        const next = project(transformPoint(points[i], item));
        this.raster.triangle(first, previous, next, rgb, item.opacity);
        previous = next;
      }
    }
  }

  #ink(item, project, scale, frameWobble) {
    const opacity = item.opacity * (item.inkOpacity ?? 1);
    if (!opacity) return;
    const wobble = (item.voice ? 1 : 0.43) * frameWobble * item.wobble;
    for (const {points, colour, width} of item.mesh.commands) {
      if (!width) continue;
      const rgb = pigment(colour, item, 1 + 0.35 * item.level);
      const radius = 0.5 * scale * width * (1 + 0.17 * item.level);
      let previous = project(transformPoint(points[0], item), wobble);
      for (let i = 1; i < points.length; i++) {
        const next = project(transformPoint(points[i], item), wobble);
        this.raster.segment(previous, next, radius, rgb, opacity, item.inkLift);
        previous = next;
      }
    }
  }
}
