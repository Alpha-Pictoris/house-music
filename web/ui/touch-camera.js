const position = event => ({ x: event.clientX, y: event.clientY });

export class TouchCamera {
  #points = new Map();
  #panning = false;

  constructor(scene) { this.scene = scene; }

  start(event) {
    if (event.pointerType !== "touch") return false;
    this.#points.set(event.pointerId, position(event));
    if (this.#points.size === 2) this.#panning = true;
    return this.#panning;
  }

  #span() {
    const [a, b] = this.#points.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  move(event) {
    if (!this.#points.has(event.pointerId)) return false;
    const before = this.#points.size === 2 && this.#span();
    this.#points.set(event.pointerId, position(event));
    if (before) {
      const after = this.#span();
      this.scene.pan(before, after, before.distance > 2 && after.distance > 2 ? after.distance / before.distance : 1);
    }
    return this.#panning;
  }

  end(event) {
    if (!this.#points.delete(event.pointerId)) return false;
    const wasPanning = this.#panning;
    if (!this.#points.size) this.#panning = false;
    return wasPanning;
  }
}
