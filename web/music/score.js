import { fittingOf } from "../building/catalogue.js";
import { notesFor } from "./phrases.js";

export class Score {
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
    const finishes = new Map(rooms.map(room => [room.id, room.finish ?? "walnut"]));
    this.events = [];
    for (const piece of pieces) {
      const onset = Math.max(0, piece.x - this.left);
      for (const { offset, ...note } of notesFor(piece)) {
        this.events.push({ ...note, pieceId: piece.id, fitting: fittingOf(piece),
          beat: (onset + offset) % this.beats, finish: finishes.get(piece.roomId) });
      }
    }
    this.events.sort((a, b) => a.beat - b.beat || a.pieceId.localeCompare(b.pieceId));
  }
}
