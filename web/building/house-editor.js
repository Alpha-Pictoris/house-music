import { newPiece, tunings } from "./catalogue.js";
import { FloorPlan } from "./floor-plan.js";
import { arrangements } from "../music/arrangements.js";

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function requireValid(message) {
  if (message) throw Error(message);
}

export class HouseEditor extends EventTarget {
  #house;
  #past = [];
  #future = [];
  #sequence = 0;

  constructor(house = { title: "Untitled house", mode: "goth", rooms: [], doors: [], pieces: [] }) {
    super();
    this.#house = freeze(structuredClone(house));
  }

  get house() { return this.#house; }
  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }

  #id(prefix) {
    const { rooms, doors, pieces } = this.house;
    const used = new Set([...rooms, ...doors, ...pieces].map(item => item.id));
    let id;
    do { id = prefix + ++this.#sequence; } while (used.has(id));
    return id;
  }

  #commit(change) {
    this.#past.push(this.house);
    if (this.#past.length > 100) this.#past.shift();
    this.#future.length = 0;
    this.#show(freeze({ ...this.house, ...change }));
  }

  #show(house) {
    this.#house = house;
    this.dispatchEvent(new Event("change"));
  }

  undo() {
    if (!this.canUndo) return;
    this.#future.push(this.house);
    this.#show(this.#past.pop());
  }

  redo() {
    if (!this.canRedo) return;
    this.#past.push(this.house);
    this.#show(this.#future.pop());
  }

  drawRoom(start, end) {
    const room = { id: this.#id("r"), ...FloorPlan.roomBetween(this.house, start, end) };
    requireValid(FloorPlan.roomError(this.house, room));
    this.#commit({ rooms: [...this.house.rooms, room] });
    return room;
  }

  #piece(id) {
    const piece = this.house.pieces.find(item => item.id === id);
    if (!piece) throw Error("Select a piece of furniture.");
    return piece;
  }

  preview(piece, point) {
    const placed = { ...piece, x: Math.round(point.x * 1000) / 1000, z: Math.round(point.z * 1000) / 1000 };
    placed.roomId = FloorPlan.roomFor(this.house, placed)?.id ?? null;
    return placed;
  }

  #put(piece) {
    requireValid(FloorPlan.pieceError(this.house, piece));
    const pieces = this.house.pieces;
    const index = pieces.findIndex(item => item.id === piece.id);
    if (index >= 0 && Object.keys(piece).every(key => piece[key] === pieces[index][key])) return pieces[index];
    this.#commit({ pieces: index < 0 ? [...pieces, piece] : pieces.map(item => item.id === piece.id ? piece : item) });
    return piece;
  }

  place(kind, point, tuning) {
    const piece = newPiece(kind);
    if (tuning !== undefined) this.#setTuning(piece, tuning);
    return this.#put(this.preview({ ...piece, id: this.#id("p") }, point));
  }

  move(id, point) { return this.#put(this.preview(this.#piece(id), point)); }

  rotate(id) {
    const piece = this.#piece(id);
    return this.#put({ ...piece, turn: (piece.turn + 1) % 4 });
  }

  #setTuning(piece, value) {
    if (!tunings(piece.kind).some(option => option.value === value)) throw Error("Choose a note or drum hit from the catalogue.");
    if (piece.kind === "lamp") piece.hit = value;
    else piece.pitch = value;
  }

  tune(id, value) {
    const piece = { ...this.#piece(id) };
    this.#setTuning(piece, value);
    return this.#put(piece);
  }

  duplicate(id, point) {
    return this.#put(this.preview({ ...this.#piece(id), id: this.#id("p") }, point));
  }

  addDoor(point) {
    const target = FloorPlan.doorAt(this.house, point);
    if (!target) throw Error("Choose a wall shared by two rooms.");
    const door = { id: this.#id("d"), rooms: target.rooms, x: target.x, z: target.z };
    requireValid(FloorPlan.doorError(this.house, door));
    this.#commit({ doors: [...this.house.doors, door] });
    return door;
  }

  remove(id) {
    const { rooms, doors, pieces } = this.house;
    if (![...rooms, ...doors, ...pieces].some(item => item.id === id)) return;
    this.#commit({
      rooms: rooms.filter(room => room.id !== id),
      doors: doors.filter(door => door.id !== id && !door.rooms.includes(id)),
      pieces: pieces.filter(piece => piece.id !== id && piece.roomId !== id)
    });
  }

  rename(title) {
    title = title.trim().slice(0, 100) || "Untitled house";
    if (title !== this.house.title) this.#commit({ title });
  }

  setMode(mode) {
    if (!Object.hasOwn(arrangements, mode)) throw Error("Choose an arrangement.");
    if (mode !== this.house.mode) this.#commit({ mode });
  }
}
