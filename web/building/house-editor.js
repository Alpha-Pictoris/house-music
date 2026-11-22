import { fittingOf, furniture, newPiece, roomFinishes } from "./catalogue.js";
import { fittings, tunings } from "./fittings.js";
import { FloorPlan } from "./floor-plan.js";
import { arrangements, defaultMode } from "../music/arrangements.js";
import { phrases } from "../music/phrases.js";

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

  constructor(house = { title: "Untitled house", mode: defaultMode, rooms: [], doors: [], pieces: [] }) {
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
    const draft = FloorPlan.planRoom(this.house, start, end);
    requireValid(draft.error);
    const room = draft.room.id ? draft.room : { ...draft.room, id: this.#id("r") };
    const rooms = draft.room.id ? this.house.rooms.map(r => r.id === room.id ? room : r) : [...this.house.rooms, room];
    const expanded = { ...this.house, rooms };
    const doors = this.house.doors.flatMap(door => {
      const wall = FloorPlan.doorAt(expanded, door, 0.00001);
      if (!wall) return [];
      return wall.rooms.length === door.rooms.length ? [door] : [{ ...door, rooms: wall.rooms }];
    });
    this.#commit({ rooms, doors });
    return room;
  }

  styleRoom(id, change) {
    const room = this.house.rooms.find(item => item.id === id);
    if (!room) throw Error("Select a room.");
    const updated = { ...room };
    if (change.finish !== undefined) {
      if (!Object.hasOwn(roomFinishes, change.finish)) throw Error("Choose a room finish.");
      updated.finish = change.finish;
    }
    if (change.name !== undefined) updated.name = change.name.trim().slice(0, 40);
    if (updated.name !== room.name || updated.finish !== room.finish) {
      this.#commit({ rooms: this.house.rooms.map(item => item.id === id ? updated : item) });
    }
  }

  #piece(id) {
    const piece = this.house.pieces.find(item => item.id === id);
    if (!piece) throw Error("Select a piece of furniture.");
    return piece;
  }

  preview(piece, point) {
    const placed = { ...piece, x: Math.round(point.x * 1000) / 1000, z: Math.round(point.z * 1000) / 1000 };
    const item = furniture[piece.kind];
    placed.roomId = null;
    if (item.layer === "wall") Object.assign(placed, FloorPlan.windowAt(this.house, point));
    else if (!item.garden) placed.roomId = FloorPlan.roomFor(this.house, placed)?.id ?? null;
    return placed;
  }

  #put(piece) {
    requireValid(FloorPlan.pieceError(this.house, piece));
    const pieces = this.house.pieces;
    const index = pieces.findIndex(item => item.id === piece.id);
    const previous = pieces[index];
    if (previous && Object.keys(previous).length === Object.keys(piece).length &&
        Object.keys(piece).every(key => piece[key] === previous[key])) return previous;
    this.#commit({ pieces: index < 0 ? [...pieces, piece] : pieces.map(item => item.id === piece.id ? piece : item) });
    return piece;
  }

  place(kind, point, tuning, turn = 0) {
    const piece = newPiece(kind);
    if (!Number.isInteger(turn) || turn < 0 || turn > 3) throw Error("Choose a quarter turn.");
    piece.turn = turn;
    if (tuning !== undefined) this.#setTuning(piece, tuning);
    return this.#put(this.preview({ ...piece, id: this.#id("p") }, point));
  }

  move(id, point) { return this.#put(this.preview(this.#piece(id), point)); }

  rotate(id) {
    const piece = this.#piece(id);
    if (furniture[piece.kind].layer === "wall") throw Error("Move the window to another wall to turn it.");
    return this.#put({ ...piece, turn: (piece.turn + 1) % 4 });
  }

  #setTuning(piece, value) {
    const fitting = fittingOf(piece);
    if (!tunings(fitting).some(option => option.value === value)) throw Error("Choose a note or drum hit from the catalogue.");
    if (fittings[fitting].hits) piece.hit = value;
    else piece.pitch = value;
  }

  fitPiece(id, fitting) {
    const piece = this.#piece(id);
    if (!Object.hasOwn(fittings, fitting) || furniture[piece.kind].garden) throw Error("Choose a fitting for an indoor piece.");
    if (fitting === fittingOf(piece)) return piece;
    const updated = { ...piece, fitting };
    delete updated.pitch;
    delete updated.hit;
    const voice = fittings[fitting];
    if (voice.hits) updated.hit = "kick";
    if (voice.sample) updated.pitch = voice.root;
    return this.#put(updated);
  }

  setPhrase(id, phrase) {
    const piece = { ...this.#piece(id) };
    if (fittingOf(piece) === "plain" || (phrase !== null && !Object.hasOwn(phrases, phrase))) throw Error("Choose a phrase for a musical fitting.");
    if (phrase === null) delete piece.phrase;
    else piece.phrase = phrase;
    return this.#put(piece);
  }

  tune(id, value) {
    const piece = { ...this.#piece(id) };
    this.#setTuning(piece, value);
    return this.#put(piece);
  }

  duplicate(id, point, turn = this.#piece(id).turn) {
    if (!Number.isInteger(turn) || turn < 0 || turn > 3) throw Error("Choose a quarter turn.");
    return this.#put(this.preview({ ...this.#piece(id), turn, id: this.#id("p") }, point));
  }

  addDoor(point) {
    const target = FloorPlan.doorAt(this.house, point);
    if (!target) throw Error("Choose a wall with room for a doorway.");
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

  setBand(enabled) {
    if (typeof enabled !== "boolean") throw Error("Switch the house band on or off.");
    if (enabled !== (this.house.band !== false)) this.#commit({ band: enabled });
  }
}
