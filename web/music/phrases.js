import { fittingOf, phraseOf } from "../building/catalogue.js";
import { fittings, minorScale } from "../building/fittings.js";

export const phrases = {
  single: { label: "One note", steps: [[0, 0]] },
  rise: { label: "Climb", steps: [[0, 0], [0.5, 2], [1, 4]] },
  fall: { label: "Fall", steps: [[0, 4], [0.75, 2], [1, 0]] },
  arch: { label: "Arpeggio", steps: [[0, 0], [0.5, 2], [1, 4], [1.5, 2]] },
  answer: { label: "Call and answer", steps: [[0, 0], [0.75, 0], [1.5, 3]] }
};

const drumAccents = ["kick", "hat", "snare", "hat", "kick"];

export function scalePitch(degree, scale) {
  return scale[(degree % 7 + 7) % 7] + 12 * Math.floor(degree / 7);
}

export function notesFor(piece, transpose = 0, scale = minorScale) {
  const voice = fittings[fittingOf(piece)];
  if (!voice.sample && !voice.hits) return [];
  const { steps } = phrases[phraseOf(piece)];
  const rootDegree = voice.hits ? 0 : minorScale.indexOf(piece.pitch - voice.root);
  return steps.map(([offset, interval], i) => {
    if (voice.hits) {
      const sample = i === 0 ? piece.hit : drumAccents[(interval + i) % drumAccents.length];
      return { offset, sample, semitones: 0, gate: null };
    }
    const semitones = scalePitch(transpose + rootDegree + interval, scale);
    const next = steps[i + 1];
    const gate = next ? Math.min(voice.gate, (next[0] - offset) * 0.9) : voice.gate;
    return { offset, sample: voice.sample, semitones, gate };
  });
}
