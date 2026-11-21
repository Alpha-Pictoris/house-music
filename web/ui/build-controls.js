import { furniture, newPiece } from "../building/catalogue.js";
import { FloorPlan } from "../building/floor-plan.js";

export class BuildControls extends EventTarget {
  selection = null;
  tool = "room";
  preview = null;
  pointer = { x: 0, z: 0 };
  #anchor = null;
  #gesture = null;
  #copy = null;
  #turn = 0;

  constructor(canvas, scene, editor, notify) {
    super();
    this.canvas = canvas;
    this.scene = scene;
    this.editor = editor;
    this.notify = notify;
    canvas.addEventListener("pointerdown", event => this.#down(event));
    canvas.addEventListener("pointermove", event => this.#move(event));
    canvas.addEventListener("pointerup", event => this.#up(event));
    canvas.addEventListener("pointercancel", () => this.cancel());
    canvas.addEventListener("lostpointercapture", () => { if (this.#gesture) this.cancel(); });
    canvas.addEventListener("pointerleave", () => { if (!this.#gesture && !this.#anchor) this.preview = null; });
    canvas.addEventListener("keydown", event => this.#key(event));
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      scene.zoom(Math.exp(-Math.max(-180, Math.min(180, event.deltaY)) * 0.002));
    }, { passive: false });
  }

  #changed() { this.dispatchEvent(new Event("change")); }

  reset(editor) {
    this.editor = editor;
    this.selection = null;
    this.pointer = { x: 0, z: 0 };
    this.scene.fit(editor.house);
    this.use(editor.house.rooms.length ? "select" : "room");
  }

  cancel() {
    this.#gesture = this.#anchor = this.preview = null;
    this.#changed();
  }

  use(tool) {
    this.tool = tool;
    this.#copy = this.kind = null;
    this.cancel();
  }

  choose(kind, source = null) {
    if (!this.editor.house.rooms.length && !furniture[kind].garden) {
      this.use("room");
      this.notify("Draw a room to place the " + furniture[kind].label.toLowerCase() + ".");
      return;
    }
    this.use("place");
    this.kind = kind;
    this.#copy = source;
    this.#turn = source?.turn ?? 0;
    this.#changed();
  }

  select(id) {
    this.selection = id || null;
    this.use("select");
  }

  get selectedPiece() { return this.editor.house.pieces.find(piece => piece.id === this.selection); }

  #run(action) {
    try { return action(); }
    catch (error) { this.notify(error.message); return null; }
  }

  rotate() {
    if (this.tool === "place" && this.kind) {
      if (furniture[this.kind].layer === "wall") return;
      this.#turn = (this.#turn + 1) % 4;
      this.#hover(this.pointer);
    } else if (this.selectedPiece) this.#run(() => this.editor.rotate(this.selection));
  }
  tune(value) { this.#run(() => this.editor.tune(this.selection, value)); }
  duplicate() {
    const piece = this.selectedPiece;
    if (piece) this.choose(piece.kind, piece);
  }

  remove() {
    if (!this.selection) return;
    this.editor.remove(this.selection);
    this.selection = null;
    this.use(this.editor.house.rooms.length ? "select" : "room");
  }

  #roomPreview(start, end) {
    const room = FloorPlan.roomBetween(this.editor.house, start, end);
    this.preview = { type: "room", ...room, valid: !FloorPlan.roomError(this.editor.house, room) };
  }

  #piecePreview(piece, point) {
    const placed = this.editor.preview(piece, point);
    this.preview = { type: "piece", piece: placed, valid: !FloorPlan.pieceError(this.editor.house, placed) };
  }

  #destination(piece, dx, dz) {
    const box = FloorPlan.footprint(piece);
    if (furniture[piece.kind].layer === "wall") return { x: box.x + box.width / 2 + dx, z: box.z + box.depth / 2 + dz };
    return { x: box.x + dx, z: box.z + dz };
  }

  #hover(point) {
    if (this.tool === "room" && this.#anchor) this.#roomPreview(this.#anchor, point);
    if (this.tool === "place" && this.kind) {
      this.#piecePreview({ ...(this.#copy ?? newPiece(this.kind)), id: null, turn: this.#turn }, point);
    }
    if (this.tool === "door") {
      const door = FloorPlan.doorAt(this.editor.house, point);
      this.preview = door ? { type: "door", ...door, valid: !FloorPlan.doorError(this.editor.house, door) } : null;
    }
  }

  #down(event) {
    if (event.button !== 0 || this.#gesture) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    const point = this.scene.groundAt(event.clientX, event.clientY);
    this.pointer = point;
    const id = this.tool === "select" ? this.scene.pick(event.clientX, event.clientY, this.editor.house) : null;
    const piece = this.editor.house.pieces.find(item => item.id === id);
    this.#gesture = { id: event.pointerId, start: point, x: event.clientX, y: event.clientY,
      lastX: event.clientX, lastY: event.clientY, piece, moved: false };
    this.canvas.setPointerCapture(event.pointerId);
  }

  #move(event) {
    const point = this.scene.groundAt(event.clientX, event.clientY);
    this.pointer = point;
    const drag = this.#gesture;
    if (!drag) { this.#hover(point); return; }
    if (event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    if (this.tool === "room") this.#roomPreview(this.#anchor ?? drag.start, point);
    else if (this.tool === "select" && drag.piece) {
      this.#piecePreview(drag.piece, this.#destination(drag.piece, point.x - drag.start.x, point.z - drag.start.z));
    } else if (this.tool === "orbit" || this.tool === "select") {
      this.scene.orbit(event.clientX - drag.lastX, event.clientY - drag.lastY);
    } else this.#hover(point);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  }

  #finishRoom(start, end) {
    this.#anchor = this.preview = null;
    const room = this.#run(() => this.editor.drawRoom(start, end));
    if (room) {
      this.select(room.id);
      this.scene.fit(this.editor.house);
      this.notify("Room drawn. Choose furniture to place inside.");
    }
  }

  #firstCorner(point) {
    this.#anchor = { ...point };
    this.preview = { type: "room", ...point, width: 0.16, depth: 0.16, valid: true };
    this.notify("Choose the opposite corner.");
  }

  #placeAt(point) {
    const piece = this.#run(() => this.#copy ? this.editor.duplicate(this.#copy.id, point, this.#turn) : this.editor.place(this.kind, point, undefined, this.#turn));
    if (piece) {
      if (piece.kind === "path" && !this.#copy) {
        this.notify("Flagstone laid. Tap to extend the path.");
        return;
      }
      this.select(piece.id);
      this.notify(furniture[piece.kind].label + (furniture[piece.kind].garden ? " placed." : " placed. Open Fittings to change its sound."));
    }
  }

  #doorAt(point) {
    const door = this.#run(() => this.editor.addDoor(point));
    if (door) {
      this.select(door.id);
      this.notify("Doorway opened.");
    }
  }

  #up(event) {
    const drag = this.#gesture;
    if (!drag || event.pointerId !== drag.id) return;
    const point = this.scene.groundAt(event.clientX, event.clientY);
    this.pointer = point;
    this.#gesture = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (this.tool === "room") {
      if (this.#anchor || drag.moved) this.#finishRoom(this.#anchor ?? drag.start, point);
      else { this.#firstCorner(point); return; }
    } else if (this.tool === "place") this.#placeAt(point);
    else if (this.tool === "door") this.#doorAt(point);
    else if (this.tool === "select" && drag.piece) {
      if (drag.moved) {
        const to = this.#destination(drag.piece, point.x - drag.start.x, point.z - drag.start.z);
        if (!this.#run(() => this.editor.move(drag.piece.id, to))) { this.preview = null; return; }
      }
      this.select(drag.piece.id);
    } else if (this.tool === "select" && !drag.moved) {
      const house = this.editor.house;
      const door = house.doors.find(d => Math.hypot(d.x - point.x, d.z - point.z) < 0.4);
      this.select(door?.id ?? FloorPlan.roomAt(house, point)?.id);
    }
    this.preview = null;
  }

  #key(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dx, dz] = arrows[event.key], step = event.shiftKey ? 1 : 0.25;
      const selected = this.selectedPiece;
      if (this.tool === "select" && selected) {
        this.#run(() => this.editor.move(selected.id, this.#destination(selected, dx * step, dz * step)));
      } else if (this.tool === "orbit") this.scene.orbit(dx * 10, dz * 10);
      else {
        this.pointer = { x: this.pointer.x + dx * step, z: this.pointer.z + dz * step };
        this.#hover(this.pointer);
        if (this.tool === "room" && !this.#anchor) this.preview = { type: "room", ...this.pointer, width: 0.15, depth: 0.15, valid: true };
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (this.tool === "room") {
        if (this.#anchor) this.#finishRoom(this.#anchor, this.pointer);
        else this.#firstCorner(this.pointer);
      } else if (this.tool === "place") this.#placeAt(this.pointer);
      else if (this.tool === "door") this.#doorAt(this.pointer);
    } else if (event.key === "Escape") this.use(this.editor.house.rooms.length ? "select" : "room");
    else if (event.key.toLowerCase() === "r") this.rotate();
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); this.remove(); }
    else if (event.key === " ") { event.preventDefault(); this.dispatchEvent(new Event("play")); }
  }
}
