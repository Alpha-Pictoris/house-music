import { furniture } from "../building/catalogue.js";
import { FloorPlan } from "../building/floor-plan.js";
import { bookcaseInscription, placeBookplate } from "./bookplate.js";
import { byId } from "./elements.js";

export class WritingMarks {
  #root = byId("writing-marks");
  #plate = byId("plot-inscription");
  #thread = byId("writing-thread");
  #bench = document.querySelector(".workbench");
  #marks = new Map();
  #seen = new Map();
  #active = null;
  #camera;

  constructor(arrange) {
    byId("follow-writing").onclick = () => {
      if (!this.#active) return;
      const id = this.#active.shelf.id;
      this.#fold(true);
      arrange(id);
    };
    byId("fold-writing").onclick = () => this.#fold(true);
    this.#root.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.#active) {
        event.preventDefault();
        this.#fold(true);
      }
    });
    const resize = new ResizeObserver(() => { this.#camera = null; });
    resize.observe(this.#plate);
    resize.observe(this.#bench);
  }

  reset() {
    this.#fold();
    this.#seen.clear();
    this.#marks.clear();
    byId("bookmarks").replaceChildren();
  }

  #mark(shelf) {
    const button = document.createElement("button");
    button.className = "writing-mark";
    button.textContent = "Writing";
    button.setAttribute("aria-label", "Read the writing on the bookcase");
    button.setAttribute("aria-controls", this.#plate.id);
    button.setAttribute("aria-expanded", "false");
    const mark = { button, shelf };
    button.onclick = () => this.#unfold(mark, true);
    byId("bookmarks").append(button);
    this.#marks.set(shelf.id, mark);
    return mark;
  }

  #unfold(mark, focus = false) {
    this.#active?.button.setAttribute("aria-expanded", "false");
    this.#active = mark;
    mark.button.setAttribute("aria-expanded", "true");
    this.#plate.hidden = false;
    byId("plot-verse").textContent = mark.text;
    byId("follow-writing").hidden = !mark.hasVerse;
    if (this.#camera && mark.screen) this.#position(this.#camera, mark);
    this.#camera = null;
    if (focus) this.#plate.focus({ preventScroll: true });
  }

  #fold(focus = false) {
    const mark = this.#active;
    this.#active = null;
    this.#plate.hidden = true;
    this.#thread.setAttribute("hidden", "");
    mark?.button.setAttribute("aria-expanded", "false");
    if (mark && focus) mark.button.focus({ preventScroll: true });
  }

  show({ writing, discoveries }, selected, tool) {
    const shelves = new Map();
    const entryForSelection = selected && writing.get(selected.id);
    for (const entry of discoveries) {
      if (entry.pool) continue;
      const shelf = entry === entryForSelection ? selected : entry.shelf;
      shelves.set(shelf.id, shelf);
    }
    if (selected?.kind === "bookcase" && !entryForSelection) shelves.set(selected.id, selected);
    for (const [id, mark] of this.#marks) {
      if (shelves.has(id)) continue;
      if (this.#active === mark) this.#fold();
      mark.button.remove();
      this.#marks.delete(id);
    }
    for (const [id, shelf] of shelves) {
      const mark = this.#marks.get(id) ?? this.#mark(shelf);
      const box = FloorPlan.footprint(shelf);
      mark.shelf = shelf;
      mark.footprint = box;
      mark.point = [box.x + box.width / 2, furniture[shelf.kind].height + 0.24, box.z + box.depth / 2];
      mark.hasVerse = writing.has(id);
      const text = bookcaseInscription(writing.get(id));
      if (this.#active === mark && mark.text !== text) this.#fold();
      mark.text = text;
    }
    this.#root.hidden = !shelves.size || !["select", "pan", "orbit"].includes(tool);
    this.#camera = null;
  }

  project(camera) {
    if (!camera || camera === this.#camera || this.#root.hidden) return;
    let unread;
    for (const mark of this.#marks.values()) {
      const point = camera.project(mark.point);
      mark.screen = point;
      const { x, y } = point;
      mark.button.hidden = x < 0 || x > camera.width || y < 0 || y > camera.height;
      if (mark.button.hidden) {
        if (this.#active === mark) this.#fold();
        continue;
      }
      mark.button.style.left = Math.max(30, Math.min(camera.width - 30, x)) + "px";
      mark.button.style.top = Math.max(34, y) + "px";
      if (this.#seen.get(mark.shelf.id) !== mark.text) {
        this.#seen.set(mark.shelf.id, mark.text);
        if (!unread || mark.hasVerse) unread = mark;
      }
    }
    if (unread && (!this.#active || unread.hasVerse)) this.#unfold(unread);
    if (this.#active) this.#position(camera, this.#active);
    this.#camera = camera;
  }

  #position(camera, { footprint, screen }) {
    const halfWidth = camera.scale * (Math.abs(camera.right[0]) * footprint.width + Math.abs(camera.right[2]) * footprint.depth) / 2;
    const rect = this.#root.getBoundingClientRect(), size = this.#plate.getBoundingClientRect();
    const bottom = Math.min(camera.height - 6, this.#bench.getBoundingClientRect().top - rect.top - 7);
    const top = Math.max(5, Math.min(byId("camera-button").getBoundingClientRect().bottom - rect.top + 5, bottom - size.height));
    const plate = placeBookplate(screen, size, { top, bottom, left: 8, right: camera.width - 8 }, halfWidth);
    this.#plate.style.left = plate.left + "px";
    this.#plate.style.top = plate.top + "px";
    const line = this.#thread.firstElementChild, pin = this.#thread.lastElementChild;
    line.setAttribute("x1", screen.x);
    line.setAttribute("y1", screen.y);
    line.setAttribute("x2", plate.threadX);
    line.setAttribute("y2", plate.threadY);
    pin.setAttribute("cx", screen.x);
    pin.setAttribute("cy", screen.y);
    this.#thread.removeAttribute("hidden");
  }
}
