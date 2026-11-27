import { fittingOf, isSmallObject } from "../building/catalogue.js";
import { BSide, Shadows } from "../building/b-side.js";
import { FloorPlan } from "../building/floor-plan.js";
import { FurnitureSpots } from "../building/furniture-spots.js";
import { arrangements } from "./arrangements.js";
import { HouseBand } from "./house-band.js";
import { notesFor, scalePitch } from "./phrases.js";

const byBeat = (a, b) => a.beat - b.beat || (a.pieceId ?? "").localeCompare(b.pieceId ?? "");
// The monitor's reply: three falling tones in the last beat and a half of the B-side pass.
const reply = [[1.5, 4], [1, 2], [0.5, 0]];
const replyGap = 2;

export class Score {
  #band;
  #passes;
  #sides;
  #seats = [new Map(), new Map()];

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
    this.#band = house.band === false ? null : new HouseBand(house.mode);
    const finishes = new Map(rooms.map(room => [room.id, room.finish ?? "walnut"]));
    // The B-side plays once a rug's shadow leads there and a shadow has been moved.
    this.#sides = pieces.some(piece => piece.shadow) && BSide.hatches(house).length ? 2 : 1;
    const parts = [];
    const seat = (piece, x, side) => {
      x = this.#band ? HouseBand.snap(x, this.left, right) : x;
      parts.push({ piece, fitting: fittingOf(piece), finish: finishes.get(piece.roomId), x, side });
      this.#seats[side].set(piece.id, x);
    };
    for (const piece of FurnitureSpots.placedPieces(pieces)) {
      if (fittingOf(piece) !== "plain") seat(piece, piece.x, 0);
    }
    if (this.#sides === 2) {
      for (const piece of pieces) if (FloorPlan.castsShadow(piece)) seat(piece, Shadows.at(piece).x, 1);
    }
    if (this.#band && parts.length) {
      const bars = parts.map(part => Math.floor(part.x / 4) * 4);
      this.left = Math.min(...bars);
      this.beats = Math.max(...bars) + 4 - this.left;
    }
    const turns = this.#band && (this.beats / 4) % 2 ? 2 : 1;
    this.#passes = [];
    for (let turn = 0; turn < turns; turn++) {
      for (let side = 0; side < this.#sides; side++) {
        this.#passes.push(this.#perform(parts.filter(part => part.side === side), turn, side).sort(byBeat));
      }
    }
    this.events = this.#passes[0];
  }

  #perform(parts, turn, side) {
    const events = [];
    if (this.#band) {
      const bars = new Map();
      for (const part of parts) {
        const bar = Math.floor(part.x / 4) * 4;
        if (!bars.has(bar)) bars.set(bar, []);
        bars.get(bar).push({ ...part, beat: part.x - bar });
      }
      for (const [bar, players] of bars) {
        players.sort((a, b) => a.beat - b.beat || a.piece.id.localeCompare(b.piece.id));
        events.push(...this.#band.perform(players, bar - this.left, turn));
      }
    } else {
      for (const { piece, fitting, finish, x } of parts) {
        const onset = Math.max(0, x - this.left);
        for (const { offset, ...note } of notesFor(piece)) {
          events.push({ ...note, pieceId: piece.id, fitting, beat: (onset + offset) % this.beats, finish });
        }
      }
    }
    if (side && this.#gap(parts)) events.push(...this.#reply());
    return events;
  }

  #gap(parts) {
    return parts.length > 0 && parts.every(part => part.x - this.left < this.beats - replyGap);
  }

  #reply() {
    const { scale, progression } = arrangements[this.house.mode];
    const chord = this.#band ? progression[(this.beats / 4 - 1) % progression.length] : 0;
    return reply.map(([before, degree]) => ({
      pieceId: BSide.monitorId, fitting: "glass", sample: "celesta", recording: "celesta", beat: this.beats - before,
      semitones: 12 + scalePitch(chord + degree, scale), gate: 0.45, velocity: 0.9
    }));
  }

  sideOf(pass) { return pass % this.#sides; }

  eventsFor(pass) { return this.#passes[pass % this.#passes.length]; }

  opening() {
    if (!this.events.length) return [];
    const downbeat = Math.floor(this.events[0].beat / 4) * 4;
    const notes = this.events.filter(note => note.beat < downbeat + 8)
      .map(note => ({ ...note, offset: note.beat - downbeat }));
    if (this.beats === 4 && this.#passes.length > this.#sides) {
      for (const note of this.#passes[this.#sides]) notes.push({ ...note, offset: 4 + note.beat });
    }
    return notes;
  }

  preview(piece, pass = 0, flipped = false) {
    const fitting = fittingOf(piece);
    if (fitting === "plain") return [];
    const finish = this.house.rooms.find(room => room.id === piece.roomId)?.finish ?? "walnut";
    if (!this.#band) return notesFor(piece).map(note => ({ ...note, finish }));
    const side = flipped && this.#sides === 2 ? 1 : 0;
    if (!this.#seats[side].has(piece.id)) {
      const part = { piece: { ...piece, id: "preview" }, fitting, finish, beat: 0 };
      return this.#band.perform([part], 0).filter(note => note.pieceId !== null)
        .map(note => ({ ...note, offset: note.beat })).sort((a, b) => a.offset - b.offset);
    }
    const onset = this.#seats[side].get(piece.id) - this.left;
    const start = Math.floor(onset / 4) * 4;
    const solo = isSmallObject(piece.kind);
    const heard = this.sideOf(pass) === side ? pass : pass + 1;
    return this.eventsFor(heard).filter(note => note.beat >= start && note.beat < start + 4
      && note.pieceId !== BSide.monitorId
      && (!solo || note.pieceId === piece.id || note.together?.includes(piece.id)))
      .map(note => ({ ...note, offset: (note.beat - onset + 4) % 4 })).sort((a, b) => a.offset - b.offset);
  }
}
