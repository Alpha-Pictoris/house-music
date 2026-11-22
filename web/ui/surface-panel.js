import { fittingOf, furniture } from "../building/catalogue.js";
import { fittings, tunings } from "../building/fittings.js";
import { Surfaces } from "../building/surfaces.js";
import { recordingFor, recordingNames } from "../music/arrangements.js";
import { HouseScene } from "../scene/house-scene.js";
import { byId } from "./elements.js";

export class SurfacePanel {
  #parentId;
  #itemId;
  #slot = 0;
  #buttons = [];
  #dialog = byId("surface-dialog");
  #portrait = byId("surface-portrait");

  constructor(controls, audition) {
    this.controls = controls;
    this.audition = audition;
    controls.addEventListener("surface", event => this.open(event.detail));
    this.#dialog.addEventListener("close", () => { if (!this.#dialog.open) this.#parentId = null; });
    this.#dialog.addEventListener("click", event => {
      if (event.target !== this.#dialog) return;
      const box = this.#dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.close();
    });
    new ResizeObserver(() => this.#draw()).observe(this.#portrait);
    for (const kind of Surfaces.objects) {
      const button = document.createElement("button"), canvas = document.createElement("canvas"), label = document.createElement("span");
      canvas.setAttribute("aria-hidden", "true");
      label.textContent = furniture[kind].label;
      button.append(canvas,label);
      button.onclick = () => this.#edit(() => this.editor.placeOn(this.#parentId,kind,this.#slot));
      byId("object-tray").append(button);
      HouseScene.thumbnail(canvas,kind);
    }
    byId("object-voice").onchange = event => this.#edit(() => this.editor.fitPiece(this.item.id, event.target.value), true);
    byId("object-tuning").onchange = event => {
      const value = event.target.value;
      this.#edit(() => this.editor.tune(this.item.id, fittings[fittingOf(this.item)].hits ? value : Number(value)), true);
    };
    byId("object-position").onchange = event => {
      const slot = Number(event.target.value);
      this.#edit(() => {
        const item = this.editor.moveOn(this.item.id,slot);
        this.#slot = item.slot;
        this.refresh();
      });
    };
    byId("remove-object").onclick = () => this.#edit(() => this.editor.remove(this.item.id));
    byId("surface-undo").onclick = () => this.editor.undo();
    byId("surface-redo").onclick = () => this.editor.redo();
  }

  get editor() { return this.controls.editor; }
  get parent() { return this.editor.house.pieces.find(p => p.id === this.#parentId); }
  get item() { return this.parent?.contents?.find(o => o.slot === this.#slot); }

  #edit(edit, preview = false) {
    try {
      const item = edit();
      if (preview && item) this.audition({ ...item, roomId: this.parent.roomId });
    } catch (error) { byId("surface-status").textContent = error.message; }
  }

  open(id) {
    this.#parentId = id;
    if (!this.parent || !Surfaces.slots(this.parent.kind).length) return;
    const empty = Surfaces.slots(this.parent.kind).findIndex((_, i) => !this.parent.contents?.some(item => item.slot === i));
    this.#slot = Math.max(0,empty);
    this.#itemId = null;
    this.#buttons = Surfaces.slots(this.parent.kind).map((_,index) => {
      const button = document.createElement("button");
      button.className = "surface-spot";
      button.append(document.createElement("span"));
      button.onclick = () => { this.#itemId = null; this.#slot = index; this.refresh(); };
      return button;
    });
    byId("surface-spots").replaceChildren(...this.#buttons);
    byId("surface-title").textContent = furniture[this.parent.kind].label;
    this.#dialog.showModal();
    this.refresh();
  }

  close() { if (this.#dialog.open) this.#dialog.close(); }

  #draw() {
    if (!this.#dialog.open || !this.parent) return;
    const points = HouseScene.surface(this.#portrait,this.parent);
    for (const [i,point] of points.entries()) {
      this.#buttons[i].style.left = point.x + "px";
      this.#buttons[i].style.top = point.y + "px";
    }
  }

  refresh() {
    if (!this.#dialog.open) return;
    const parent = this.parent;
    if (!parent) { this.close(); return; }
    const selected = parent.contents?.find(item => item.id === this.#itemId);
    if (selected) this.#slot = selected.slot;
    this.#itemId = this.item?.id;
    const slots = Surfaces.slots(parent.kind);
    for (const [i,button] of this.#buttons.entries()) {
      const item = parent.contents?.find(o => o.slot === i);
      const name = slots[i].label + " · " + (item ? furniture[item.kind].label : "Empty");
      button.setAttribute("aria-label",name);
      button.setAttribute("aria-pressed",String(i === this.#slot));
      button.title = name;
      button.dataset.filled = String(Boolean(item));
      button.firstChild.textContent = item ? "" : "+";
    }
    this.#draw();
    const item = this.item, mode = this.editor.house.mode, spot = slots[this.#slot].label;
    byId("object-tray").hidden = Boolean(item);
    byId("object-fields").hidden = !item;
    byId("surface-undo").disabled = !this.editor.canUndo;
    byId("surface-redo").disabled = !this.editor.canRedo;
    byId("surface-status").textContent = item ? spot + " · " + furniture[item.kind].label : "Choose an object for the " + spot.toLowerCase() + " spot.";
    if (!item) return;
    const fitting = fittingOf(item), voice = byId("object-voice");
    voice.replaceChildren(...Object.entries(fittings).map(([key, material]) => new Option(
      material.sample ? recordingNames[recordingFor(mode,material.sample)] : material.voice, key)));
    voice.value = fitting;
    byId("object-tuning-field").hidden = fitting === "plain";
    const tuning = byId("object-tuning");
    tuning.replaceChildren(...tunings(fitting, this.editor.house.band !== false).map(t => new Option(t.label,t.value)));
    tuning.value = item.hit ?? item.pitch ?? "";
    const position = byId("object-position");
    position.replaceChildren(...slots.map((s,i) => {
      const option = new Option(s.label,i);
      option.disabled = parent.contents.some(other => other.slot === i && other.id !== item.id);
      return option;
    }));
    position.value = this.#slot;
  }
}
