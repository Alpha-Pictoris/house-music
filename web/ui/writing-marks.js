import { furniture } from "../building/catalogue.js";
import { FloorPlan } from "../building/floor-plan.js";
import { byId, icon } from "./elements.js";

export class WritingMarks {
  #marks = new Map();
  #camera;

  constructor(read) { this.read = read; }

  show(discoveries, tool) {
    byId("writing-marks").hidden = tool !== "select";
    const shelves = discoveries.filter(entry => !entry.pool).map(entry => entry.shelf);
    const ids = new Set(shelves.map(shelf => shelf.id));
    for (const [id, mark] of this.#marks) {
      if (ids.has(id)) continue;
      mark.button.remove();
      this.#marks.delete(id);
    }
    for (const shelf of shelves) {
      let mark = this.#marks.get(shelf.id);
      if (mark?.shelf === shelf) continue;
      if (!mark) {
        const button = document.createElement("button");
        button.className = "writing-mark";
        button.setAttribute("aria-label", "Read the writing on the bookcase");
        button.append(icon("writing"), "Writing");
        button.onclick = () => this.read(shelf.id);
        byId("writing-marks").append(button);
        mark = { button };
        this.#marks.set(shelf.id, mark);
      }
      const box = FloorPlan.footprint(shelf);
      mark.shelf = shelf;
      mark.point = [box.x + box.width / 2, furniture[shelf.kind].height + 0.24, box.z + box.depth / 2];
      this.#camera = null;
    }
  }

  project(camera) {
    if (!camera || camera === this.#camera) return;
    this.#camera = camera;
    for (const { point, button } of this.#marks.values()) {
      const { x, y } = camera.project(point);
      button.hidden = x < 0 || x > camera.width || y < 25 || y > camera.height;
      button.style.left = x + "px";
      button.style.top = y + "px";
    }
  }
}
