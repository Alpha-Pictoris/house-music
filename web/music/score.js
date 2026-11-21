import { fittingOf } from "../building/catalogue.js";
import { HouseBand } from "./house-band.js";
import { notesFor } from "./phrases.js";

export class Score {
  #band;
  #seats = new Map();

  static from(house) {
    return new Score(house);
  }

  constructor(house) {
    this.house = house;
    const { rooms, pieces } = house;
    this.left = rooms.length ? Math.floor(Math.min(...rooms.map(room => room.x)) / 4) * 4 : 0;
    const rightEdge = rooms.length ? Math.max(...rooms.map(room => room.x + room.width)) : 4;
    // Decimal room dimensions can sum to just above an exact bar line.
    const right = Math.ceil((rightEdge - 1e-12) / 4) * 4;
    this.beats = Math.max(4, right - this.left);
    this.events = [];
    this.#band = house.band === false ? null : new HouseBand(house.mode);
    const finishes = new Map(rooms.map(room => [room.id, room.finish ?? "walnut"]));
    const bars = new Map();
    for (const piece of pieces) {
      const fitting = fittingOf(piece);
      if (fitting === "plain") continue;
      const finish = finishes.get(piece.roomId);
      if (this.#band) {
        const x = HouseBand.snap(piece.x, this.left, right);
        const bar = Math.floor(x / 4) * 4;
        if (!bars.has(bar)) bars.set(bar, []);
        bars.get(bar).push({ piece, finish, fitting, beat: x - bar });
        this.#seats.set(piece.id, x);
      } else {
        const onset = Math.max(0, piece.x - this.left);
        for (const { offset, ...note } of notesFor(piece)) {
          this.events.push({ ...note, pieceId: piece.id, fitting, beat: (onset + offset) % this.beats, finish });
        }
      }
    }

    if (bars.size) {
      this.left = Math.min(...bars.keys());
      this.beats = Math.max(...bars.keys()) + 4 - this.left;
      for (const [bar, parts] of bars) {
        parts.sort((a, b) => a.beat - b.beat || a.piece.id.localeCompare(b.piece.id));
        this.events.push(...this.#band.perform(parts, bar - this.left));
      }
    }
    this.events.sort((a, b) => a.beat - b.beat || (a.pieceId ?? "").localeCompare(b.pieceId ?? ""));
  }

  preview(piece) {
    const fitting = fittingOf(piece);
    if (fitting === "plain") return [];
    const finish = this.house.rooms.find(room => room.id === piece.roomId)?.finish ?? "walnut";
    if (!this.#band) return notesFor(piece).map(note => ({ ...note, finish }));
    if (!this.#seats.has(piece.id)) {
      const part = { piece: { ...piece, id: "preview" }, fitting, finish, beat: 0 };
      return this.#band.perform([part], 0).filter(note => note.pieceId !== null)
        .map(note => ({ ...note, offset: note.beat })).sort((a, b) => a.offset - b.offset);
    }
    const onset = this.#seats.get(piece.id) - this.left;
    const start = Math.floor(onset / 4) * 4;
    return this.events.filter(note => note.beat >= start && note.beat < start + 4)
      .map(note => ({ ...note, offset: (note.beat - onset + 4) % 4 })).sort((a, b) => a.offset - b.offset);
  }
}
