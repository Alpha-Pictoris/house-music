import { isSmallObject } from "../building/catalogue.js";
import { fittings, minorScale } from "../building/fittings.js";
import { arrangements } from "./arrangements.js";
import { BarMix } from "./bar-mix.js";
import { scalePitch, notesFor } from "./phrases.js";
import { responses } from "./responses.js";

function lastPlayer(players, beat) {
  return players.findLast(player => player.beat <= beat) ?? players.at(-1);
}

export class HouseBand {
  constructor(mode) {
    this.mode = mode;
    this.arrangement = arrangements[mode];
    this.responses = responses[mode];
  }

  static snap(x, left, right) {
    return Math.max(left, Math.min(right - 0.5, Math.round(x * 2) / 2));
  }

  perform(parts, start, turn = 0) {
    const { progression } = this.arrangement;
    const chord = progression[(start / 4) % progression.length];
    const bar = start / 4 + turn;
    const mix = new BarMix(this.mode);
    const lanes = new Map();
    const objects = [];
    for (const part of parts) {
      if (isSmallObject(part.piece.kind)) {
        objects.push(part);
        continue;
      }
      if (!lanes.has(part.fitting)) lanes.set(part.fitting, []);
      lanes.get(part.fitting).push(part);
    }
    const drums = lanes.get("stud") ?? [];
    this.#rhythm(mix, drums.filter(part => !part.piece.phrase), lanes.get("ring") ?? [], chord, bar);

    for (const lane of lanes.values()) {
      const beats = [...new Set(lane.map(part => part.beat))];
      const space = new Map(beats.map((beat, i) => [beat, (beats[i + 1] ?? beats[0] + 4) - beat]));
      for (const part of lane) {
        if (part.fitting !== "ring" || part.piece.phrase) this.#playPart(mix, part, chord, space.get(part.beat));
      }
    }
    this.#answer(mix, lanes, chord, bar);
    for (const part of objects) {
      for (const note of notesFor(part.piece, chord, this.arrangement.scale)) mix.accent(part, note);
    }
    return mix.events(start);
  }

  #rhythm(mix, drummers, bassists, chord, bar) {
    const { groove, scale } = this.arrangement;
    const drums = bar % 2 === 1 && groove.turnaround ? groove.turnaround : groove.drums;
    for (const [sample, strokes] of Object.entries(drums)) {
      for (const [beat, velocity] of strokes) {
        const player = lastPlayer(drummers, beat);
        mix.add(player, "stud", beat, { sample, semitones: 0, gate: null }, velocity * (player ? 0.95 : 0.79));
      }
    }
    for (const [beat, degree, gate, velocity] of groove.ring) {
      const player = lastPlayer(bassists, beat);
      if (player?.piece.phrase) continue;
      const root = player ? minorScale.indexOf(player.piece.pitch - fittings.ring.root) : 0;
      mix.add(player, "ring", beat, { sample: "bass", semitones: scalePitch(chord + root + degree, scale), gate },
        velocity * (player ? 1 : 0.76));
    }
  }

  #answer(mix, lanes, chord, bar) {
    const melody = mix.notes.filter(note => note.fitting !== "stud" && note.fitting !== "ring");
    for (const { fitting, recording, unless, bars } of this.responses) {
      if (lanes.has(unless)) continue;
      const sample = fittings[fitting].sample;
      for (const [beat, degrees, gate, velocity] of bars[bar % bars.length]) {
        const overlaps = melody.some(note => beat < note.beat + note.gate && note.beat < beat + gate);
        for (const degree of Array.isArray(degrees) ? degrees : [degrees]) {
          const semitones = scalePitch(chord + degree, this.arrangement.scale);
          mix.add(null, fitting, beat, { sample, recording, semitones, gate }, overlaps ? velocity * 0.65 : velocity);
        }
      }
    }
  }

  #playPart(mix, part, chord, space) {
    for (const { offset, semitones, gate, sample, velocity } of this.#figure(part, chord)) {
      if (offset >= space) break;
      const beat = (part.beat + offset) % 4;
      const length = gate === null ? null : Math.min(gate, space - offset, 4 - beat);
      mix.add(part, part.fitting, beat, { sample, semitones, gate: length }, velocity);
    }
  }

  #figure({ piece, fitting }, chord) {
    const instrument = fittings[fitting];
    const { groove, scale } = this.arrangement;
    if (piece.phrase) {
      return notesFor(piece, chord, scale).map((note, i) => ({ ...note, velocity: i === 0 ? 1 : 0.82 }));
    }
    if (instrument.hits) return [{ offset: 0, semitones: 0, sample: piece.hit, gate: null, velocity: 1 }];
    const root = chord + minorScale.indexOf(piece.pitch - instrument.root);
    return groove[fitting].map(([offset, degree, gate, velocity]) => ({
      offset, semitones: scalePitch(root + degree, scale), sample: instrument.sample, gate, velocity
    }));
  }
}
