import { furniture } from "../building/catalogue.js";
import { InstrumentPanel } from "./instrument-panel.js";
import { FurnitureSpots } from "../building/furniture-spots.js";
import { HouseScene } from "../scene/house-scene.js";
import { bookcaseInscription } from "./bookplate.js";
import { byId } from "./elements.js";

export class ObjectPanel {
  #parentId;
  #itemId;
  #slot = 0;
  #buttons = [];
  #moving = false;
  #dialog = byId("object-dialog");
  #portrait = byId("object-portrait");

  constructor(controls, audition, glass) {
    this.glass = glass;
    this.controls = controls;
    this.audition = audition;
    controls.addEventListener("arrange", event => this.open(event.detail));
    this.#dialog.addEventListener("close", () => { if (!this.#dialog.open) this.#parentId = null; });
    this.#dialog.addEventListener("click", event => {
      if (event.target !== this.#dialog) return;
      const box = this.#dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.close();
    });
    new ResizeObserver(() => this.#draw()).observe(this.#portrait);
    for (const kind of FurnitureSpots.objects) {
      const button = document.createElement("button"), canvas = document.createElement("canvas"), label = document.createElement("span");
      canvas.setAttribute("aria-hidden", "true");
      label.textContent = furniture[kind].label;
      button.append(canvas,label);
      button.onclick = () => this.#edit(() => this.editor.placeOn(this.#parentId,kind,this.#slot));
      byId("object-tray").append(button);
      HouseScene.thumbnail(canvas,kind);
    }
    this.sound = new InstrumentPanel(byId("object-sound"), (method, id, value) => {
      this.#edit(() => this.editor[method](id, value), true);
    });
    byId("object-sound-button").onclick = () => {
      byId("object-sound").hidden = !byId("object-sound").hidden;
      this.#moving = false;
      this.refresh();
    };
    byId("move-object").onclick = () => {
      this.#moving = !this.#moving;
      byId("object-sound").hidden = true;
      this.refresh();
    };
    byId("remove-object").onclick = () => this.#edit(() => this.editor.remove(this.item.id));
    byId("see-water").onclick = () => {
      const entry = this.glass.read(this.editor.house).writing.get(this.#parentId);
      if (!entry?.pool) return;
      this.close();
      controls.select(null);
      controls.scene.fit({ rooms: [entry.room], pieces: [] });
      controls.canvas.focus({ preventScroll: true });
    };
    byId("object-undo").onclick = () => this.editor.undo();
    byId("object-redo").onclick = () => this.editor.redo();
  }

  get editor() { return this.controls.editor; }
  get parent() { return this.editor.house.pieces.find(p => p.id === this.#parentId); }
  get item() { return this.parent?.contents?.find(o => o.slot === this.#slot); }

  #edit(edit, preview = false) {
    try {
      const item = edit();
      if (preview && item) this.audition({ ...item, roomId: this.parent.roomId });
    } catch (error) { byId("object-status").textContent = error.message; }
  }

  open(id) {
    this.#parentId = id;
    if (!this.parent || !FurnitureSpots.slots(this.parent.kind).length) return;
    const empty = FurnitureSpots.slots(this.parent.kind).findIndex((_, i) => !this.parent.contents?.some(item => item.slot === i));
    this.#slot = Math.max(0,empty);
    this.#itemId = null;
    this.#moving = false;
    byId("object-sound").hidden = true;
    this.#buttons = FurnitureSpots.slots(this.parent.kind).map((_,index) => {
      const button = document.createElement("button");
      button.className = "object-spot";
      button.append(document.createElement("span"));
      button.onclick = () => {
        if (this.#moving && this.item) this.#edit(() => this.editor.moveOn(this.item.id, index));
        this.#moving = false;
        this.#itemId = null;
        this.#slot = index;
        byId("object-sound").hidden = true;
        this.refresh();
      };
      return button;
    });
    byId("object-spots").replaceChildren(...this.#buttons);
    byId("object-title").textContent = furniture[this.parent.kind].label;
    this.#dialog.showModal();
    this.refresh();
  }

  close() { if (this.#dialog.open) this.#dialog.close(); }

  #draw() {
    if (!this.#dialog.open || !this.parent) return;
    const writing = this.glass.read(this.editor.house).writing.has(this.#parentId);
    const points = HouseScene.furniturePortrait(this.#portrait, this.parent, writing);
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
    if (this.#itemId && !selected) {
      this.#moving = false;
      byId("object-sound").hidden = true;
    }
    this.#itemId = this.item?.id;
    const slots = FurnitureSpots.slots(parent.kind);
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
    const item = this.item, spot = slots[this.#slot].label;
    byId("object-tray").hidden = Boolean(item);
    byId("object-fields").hidden = !item;
    byId("object-undo").disabled = !this.editor.canUndo;
    byId("object-redo").disabled = !this.editor.canRedo;
    byId("move-object").setAttribute("aria-pressed", String(this.#moving));
    byId("object-sound-button").setAttribute("aria-expanded", String(!byId("object-sound").hidden));
    byId("object-spots").classList.toggle("moving", this.#moving);
    byId("object-status").textContent = this.#moving ? "Tap a spot to move or swap."
      : item ? spot + " · " + furniture[item.kind].label : "Choose an object for the " + spot.toLowerCase() + " spot.";
    if (item) this.sound.show(item, this.editor.house);
    const entry = this.glass.read(this.editor.house).writing.get(parent.id);
    byId("inscription").hidden = parent.kind !== "bookcase";
    if (parent.kind === "bookcase") {
      const text = bookcaseInscription(entry);
      if (byId("inscription-text").textContent !== text) byId("inscription-text").textContent = text;
      byId("see-water").hidden = !entry?.pool;
    }
  }
}
