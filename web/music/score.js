import { voiceFor } from "../building/catalogue.js";

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
    this.events = pieces.map(piece => ({
      pieceId: piece.id, beat: Math.max(0, piece.x - this.left), ...voiceFor(piece)
    })).sort((a, b) => a.beat - b.beat || a.pieceId.localeCompare(b.pieceId));
  }
}
