import { fittings, minorScale } from "../building/fittings.js";
import { arrangements, recordingFor } from "./arrangements.js";
import { scalePitch, notesFor } from "./phrases.js";
import { responses } from "./responses.js";

const balance = { guitar: 0.88, bass: 0.80, celesta: 0.66, harp: 0.62, kick: 1, snare: 0.90, hat: 0.72,
  talkbox: 0.94, "fuzz-lead": 0.80, "low-chug": 0.95, "gang-hit": 0.85, croon: 0.86 };

function lastPlayer(players, beat) {
  return players.findLast(player => player.beat <= beat) ?? players.at(-1);
}

function restLength(melody, beat, gate) {
  let length = gate;
  for (const note of melody) {
    if (note.beat <= beat && beat < note.beat + note.gate) return 0;
    if (note.beat > beat) length = Math.min(length, note.beat - beat);
  }
  return length;
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
    const mix = new Map();
    const lanes = new Map();
    for (const part of parts) {
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
    return this.#mixBar(mix, start);
  }

  #rhythm(mix, drummers, bassists, chord, bar) {
    const { groove, scale } = this.arrangement;
    const drums = bar % 2 === 1 && groove.turnaround ? groove.turnaround : groove.drums;
    for (const [sample, strokes] of Object.entries(drums)) {
      for (const [beat, velocity] of strokes) {
        const player = lastPlayer(drummers, beat);
        this.#add(mix, player, "stud", beat, { sample, semitones: 0, gate: null, finish: player?.finish }, velocity * (player ? 0.95 : 0.79));
      }
    }
    for (const [beat, degree, gate, velocity] of groove.ring) {
      const player = lastPlayer(bassists, beat);
      if (player?.piece.phrase) continue;
      const root = player ? minorScale.indexOf(player.piece.pitch - fittings.ring.root) : 0;
      this.#add(mix, player, "ring", beat, { sample: "bass", semitones: scalePitch(chord + root + degree, scale), gate, finish: player?.finish },
        velocity * (player ? 1 : 0.76));
    }
  }

  #answer(mix, lanes, chord, bar) {
    const melody = [...mix.values()].filter(note => note.fitting !== "stud" && note.fitting !== "ring");
    for (const { fitting, recording, unless, bars } of this.responses) {
      if (lanes.has(unless)) continue;
      const sample = fittings[fitting].sample;
      for (const [beat, degrees, length, velocity] of bars[bar % bars.length]) {
        const gate = restLength(melody, beat, length);
        if (gate < 0.12) continue;
        for (const degree of Array.isArray(degrees) ? degrees : [degrees]) {
          const semitones = scalePitch(chord + degree, this.arrangement.scale);
          this.#add(mix, null, fitting, beat, { sample, recording, semitones, gate }, velocity);
        }
        melody.push({ beat, gate });
      }
    }
  }

  #playPart(mix, part, chord, space) {
    for (const { offset, semitones, gate, sample, velocity } of this.#figure(part, chord)) {
      if (offset >= space) break;
      const beat = (part.beat + offset) % 4;
      const length = gate === null ? null : Math.min(gate, space - offset, 4 - beat);
      this.#add(mix, part, part.fitting, beat, { sample, semitones, gate: length, finish: part.finish }, velocity);
    }
  }

  #mixBar(mix, start) {
    const events = [...mix.values()];
    const layerCounts = new Map();
    for (const note of events) {
      const key = note.recording + ":" + note.beat;
      layerCounts.set(key, (layerCounts.get(key) ?? 0) + 1);
    }
    for (const note of events) {
      note.velocity /= Math.sqrt(layerCounts.get(note.recording + ":" + note.beat));
      note.beat += start;
    }
    return events;
  }

  #figure({ piece, fitting }, chord) {
    const voice = fittings[fitting];
    const { groove, scale } = this.arrangement;
    if (piece.phrase) {
      return notesFor(piece, chord, scale).map((note, i) => ({ ...note, velocity: i === 0 ? 1 : 0.82 }));
    }
    if (voice.hits) return [{ offset: 0, semitones: 0, sample: piece.hit, gate: null, velocity: 1 }];
    const root = chord + minorScale.indexOf(piece.pitch - voice.root);
    return groove[fitting].map(([offset, degree, gate, velocity]) => ({
      offset, semitones: scalePitch(root + degree, scale), sample: voice.sample, gate, velocity
    }));
  }

  #add(mix, part, fitting, beat, note, velocity) {
    const recording = note.recording ?? recordingFor(this.mode, note.sample);
    const key = [beat, recording, note.sample === "bass" ? 0 : note.semitones].join("/");
    const level = velocity * (balance[recording] ?? balance[note.sample]);
    const current = mix.get(key);
    if (!current) {
      mix.set(key, { ...note, recording, beat, fitting, pieceId: part?.piece.id ?? null, velocity: level });
      return;
    }
    current.velocity = Math.max(current.velocity, level);
    if (note.gate !== null) current.gate = Math.max(current.gate, note.gate);
    if (!part || part.piece.id === current.pieceId) return;
    if (current.pieceId === null) {
      current.pieceId = part.piece.id;
      current.finish = part.finish;
    } else {
      current.together ??= [current.pieceId];
      if (!current.together.includes(part.piece.id)) current.together.push(part.piece.id);
    }
  }
}
