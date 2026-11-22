import { recordingFor } from "./arrangements.js";

const balance = {
  guitar: 0.88, bass: 0.80, celesta: 0.66, harp: 0.62, kick: 1, snare: 0.90, hat: 0.72,
  talkbox: 0.94, "fuzz-lead": 0.80, "low-chug": 0.95, "gang-hit": 0.85, croon: 0.86
};

export class BarMix {
  #chords = new Map();

  constructor(mode) { this.mode = mode; }

  get notes() { return [...this.#chords.values()].flatMap(chord => chord.notes); }

  add(part, fitting, beat, note, velocity) {
    this.#strike(part, fitting, beat, note, velocity, false);
  }

  accent(part, { sample, semitones, offset, gate }) {
    const beat = (part.beat + offset) % 4;
    const length = gate === null ? null : Math.min(gate, 0.45, 4 - beat);
    this.#strike(part, part.fitting, beat, { sample, semitones, gate: length }, offset === 0 ? 0.64 : 0.50, true);
  }

  #strike(part, fitting, beat, note, velocity, accent) {
    const recording = note.recording ?? recordingFor(this.mode, note.sample);
    const key = beat + "/" + recording;
    if (!this.#chords.has(key)) this.#chords.set(key, { notes: [], bandSize: 0 });
    const chord = this.#chords.get(key);
    const level = velocity * (balance[recording] ?? balance[note.sample]);
    const hit = note.sample === "bass" && !accent ? chord.notes[0] : chord.notes.find(n => n.semitones === note.semitones);
    if (!hit) {
      chord.notes.push({ ...note, recording, fitting, beat, velocity: level, pieceId: part?.piece.id ?? null, finish: part?.finish });
      if (!accent) chord.bandSize++;
      return;
    }
    if (!accent) {
      hit.velocity = Math.max(hit.velocity, level);
      if (note.gate !== null) hit.gate = Math.max(hit.gate, note.gate);
      if (part && hit.pieceId === null) hit.finish = part.finish;
    }
    if (!part || hit.pieceId === part.piece.id) return;
    if (hit.pieceId === null) hit.pieceId = part.piece.id;
    else {
      hit.together ??= [hit.pieceId];
      if (!hit.together.includes(part.piece.id)) hit.together.push(part.piece.id);
    }
  }

  events(start) {
    const events = [];
    for (const { notes, bandSize } of this.#chords.values()) {
      for (const [i, note] of notes.entries()) {
        const layers = i < bandSize ? bandSize : notes.length;
        events.push({ ...note, beat: note.beat + start, velocity: note.velocity / Math.sqrt(layers) });
      }
    }
    return events;
  }
}
