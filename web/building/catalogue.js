const minorScale = [0, 2, 3, 5, 7, 8, 10, 12];
const notes = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const furniture = {
  wardrobe: { label: "Wardrobe", voice: "Distorted guitar", colour: "#ff897b", width: 1.85, depth: 1, height: 3.1, sample: "guitar", root: 50, gate: 1 },
  mirror: { label: "Mirror", voice: "Picked bass", colour: "#76e7df", width: 1.45, depth: 0.65, height: 2.7, sample: "bass", root: 38, gate: 0.5 },
  lamp: { label: "Lamp", voice: "Drum kit", colour: "#d8eb90", width: 1, depth: 1, height: 2.3, hits: { kick: "Kick", snare: "Snare", hat: "Closed hat" } }
};

export function tunings(kind) {
  const item = furniture[kind];
  if (item.hits) return Object.entries(item.hits).map(([value, label]) => ({ value, label }));
  return minorScale.map(step => {
    const value = item.root + step;
    return { value, label: notes[value % 12] + (Math.floor(value / 12) - 1) };
  });
}

export function voiceFor(piece) {
  const item = furniture[piece.kind];
  return { sample: item.sample ?? piece.hit, semitones: item.root ? piece.pitch - item.root : 0, gate: item.gate ?? null };
}

export function newPiece(kind) {
  if (!Object.hasOwn(furniture, kind)) throw Error("Choose a piece of furniture.");
  const item = furniture[kind];
  return { kind, turn: 0, ...(item.hits ? { hit: "kick" } : { pitch: item.root }) };
}
