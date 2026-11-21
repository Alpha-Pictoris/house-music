import { minorScale } from "../building/fittings.js";
import { cassette, chrome, floorboards, landing, moth } from "./grooves.js";

const major = [0, 2, 4, 5, 7, 9, 11];
const dorian = [0, 2, 3, 5, 7, 9, 10];
export const defaultMode = "chrome";

export const arrangements = {
  chrome: {
    label: "Chrome Attic", bpm: 128, scale: dorian, progression: [0, 3, 5, 4], groove: chrome,
    voices: { guitar: "filter-chord", bass: "synth-bass", celesta: "synth-lead", harp: "electric-piano", kick: "machine-kick", snare: "clap" }
  },
  moth: {
    label: "Moth Mass", bpm: 176, scale: minorScale, progression: [0, -2, -1, -3], groove: moth,
    voices: { celesta: "pipe-organ", harp: "strings" }
  },
  floorboards: {
    label: "Loose Floorboards", bpm: 108, scale: dorian, progression: [0, 0, -1, 3], groove: floorboards,
    voices: { guitar: "mute-guitar", bass: "slap-bass", celesta: "electric-piano", harp: "celesta" }
  },
  cassette: {
    label: "Bent Cassette", bpm: 84, scale: minorScale, progression: [2, -1, 0, -2], groove: cassette,
    voices: { guitar: "nylon", bass: "round-bass", celesta: "electric-piano", snare: "rim" }
  },
  landing: {
    label: "Brass Landing", bpm: 160, scale: major, progression: [0, 3, 4, 0], groove: landing,
    voices: { guitar: "upstroke", celesta: "horns", harp: "reed-organ" }
  }
};

export const recordingNames = {
  guitar: "Distorted guitar", bass: "Picked bass", kick: "Kick", snare: "Snare", hat: "Closed hat",
  celesta: "Celesta", harp: "Harp", "filter-chord": "Filter synth", "synth-bass": "Synth bass",
  "synth-lead": "Square lead", "electric-piano": "Electric piano", "machine-kick": "Machine kick",
  clap: "Handclap", "pipe-organ": "Pipe organ", strings: "Bowed strings", "mute-guitar": "Muted guitar",
  "slap-bass": "Slap bass", nylon: "Nylon guitar", "round-bass": "Fretless bass", rim: "Side stick",
  upstroke: "Upstroke guitar", horns: "Brass section", "reed-organ": "Reed organ"
};

export function recordingFor(mode, sample) {
  return arrangements[mode].voices[sample] ?? sample;
}
