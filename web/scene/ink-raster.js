import {clamp} from './ink-mesh.js';

export class InkRaster {
  // Both views give each swatch the pixel buffer's native byte order.
  #swatch = new Uint8ClampedArray([0, 0, 0, 255]);
  #packed = new Uint32Array(this.#swatch.buffer);

  clear(ctx, width, height) {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.image = ctx.createImageData(width, height);
      this.pixels = new Uint32Array(this.image.data.buffer);
      this.depth = new Float32Array(width * height);
    } else {
      this.image.data.fill(0);
    }
    this.depth.fill(-Infinity);
  }

  #blend(pixel, [r, g, b], opacity) {
    const rgba = this.image.data, i = pixel * 4;
    let weight = opacity;
    if (rgba[i + 3] < 255) {
      const alpha = opacity + (1 - opacity) * rgba[i + 3] / 255;
      weight = opacity / alpha;
      rgba[i + 3] = 255 * alpha;
    }
    rgba[i] += (r - rgba[i]) * weight;
    rgba[i + 1] += (g - rgba[i + 1]) * weight;
    rgba[i + 2] += (b - rgba[i + 2]) * weight;
  }

  triangle(a, b, c, colour, opacity) {
    if (a.y > b.y) [a, b] = [b, a];
    if (b.y > c.y) [b, c] = [c, b];
    if (a.y > b.y) [a, b] = [b, a];
    if (c.y < 0 || a.y >= this.height || Math.max(a.x, b.x, c.x) < 0 || Math.min(a.x, b.x, c.x) >= this.width) return;
    const abX = b.x - a.x, abY = b.y - a.y, acX = c.x - a.x, acY = c.y - a.y;
    const area = abX * acY - abY * acX;
    if (Math.abs(area) < 1e-8) return;
    const dzX = ((b.z - a.z) * acY - (c.z - a.z) * abY) / area;
    const dzY = (abX * (c.z - a.z) - acX * (b.z - a.z)) / area;
    const slopeAC = acX / acY, slopeAB = abY ? abX / abY : 0;
    const slopeBC = c.y > b.y ? (c.x - b.x) / (c.y - b.y) : 0;
    // Half-open spans give each shared edge to one triangle.
    const start = Math.max(0, Math.ceil(a.y - 0.5)), end = Math.min(this.height, Math.ceil(c.y - 0.5));
    this.#swatch.set(colour);
    const packed = this.#packed[0], {pixels, depth} = this;
    for (let row = start; row < end; row++) {
      const y = row + 0.5;
      const across = a.x + (y - a.y) * slopeAC;
      const side = y < b.y ? a.x + (y - a.y) * slopeAB : b.x + (y - b.y) * slopeBC;
      const left = Math.max(0, Math.ceil(Math.min(across, side) - 0.5));
      const right = Math.min(this.width, Math.ceil(Math.max(across, side) - 0.5));
      let z = a.z + (left + 0.5 - a.x) * dzX + (y - a.y) * dzY;
      let pixel = row * this.width + left;
      const stop = row * this.width + right;
      if (opacity === 1) {
        for (; pixel < stop; pixel++, z += dzX) {
          if (z < depth[pixel] - 1e-6) continue;
          depth[pixel] = z;
          pixels[pixel] = packed;
        }
      } else {
        for (; pixel < stop; pixel++, z += dzX) {
          if (z >= depth[pixel] - 1e-6) this.#blend(pixel, colour, opacity);
        }
      }
    }
  }

  segment(a, b, radius, colour, opacity, lift) {
    const edge = radius + 0.5, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    if (Math.max(a.x, b.x) + edge < 0 || Math.min(a.x, b.x) - edge >= this.width) return;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return;
    const top = Math.max(0, Math.ceil(Math.min(a.y, b.y) - edge - 0.5));
    const bottom = Math.min(this.height, Math.ceil(Math.max(a.y, b.y) + edge - 0.5));
    for (let row = top; row < bottom; row++) {
      const y = row + 0.5 - a.y;
      const t0 = dy ? clamp((y - edge) / dy, 0, 1) : 0, t1 = dy ? clamp((y + edge) / dy, 0, 1) : 1;
      const x0 = a.x + t0 * dx, x1 = a.x + t1 * dx;
      const left = Math.max(0, Math.ceil(Math.min(x0, x1) - edge - 0.5));
      const right = Math.min(this.width, Math.ceil(Math.max(x0, x1) + edge - 0.5));
      for (let col = left; col < right; col++) {
        const x = col + 0.5 - a.x;
        const t = clamp((x * dx + y * dy) / lengthSquared, 0, 1);
        const pixel = row * this.width + col;
        if (a.z + t * dz + lift < this.depth[pixel]) continue;
        const u = x - t * dx, v = y - t * dy, distanceSquared = u * u + v * v;
        if (distanceSquared >= edge * edge) continue;
        this.#blend(pixel, colour, opacity * Math.min(1, edge - Math.sqrt(distanceSquared)));
      }
    }
  }
}
