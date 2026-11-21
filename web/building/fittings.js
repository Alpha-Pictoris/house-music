export const fittings = {
  plain: { label: "Plain", voice: "Silent", colour: "#bfb0b9" },
  thorn: { label: "Thorn carving", colour: "#ff9382", sample: "guitar", root: 50, gate: 1 },
  ring: { label: "Iron rings", colour: "#84e5dc", sample: "bass", root: 38, gate: 0.55 },
  stud: { label: "Brass studs", voice: "Drums", colour: "#d8eb90", hits: { kick: "Kick", snare: "Snare", hat: "Closed hat" } },
  glass: { label: "Cut glass", colour: "#d2adff", sample: "celesta", root: 62, gate: 0.85 },
  wire: { label: "Silver strings", colour: "#f6cb98", sample: "harp", root: 62, gate: 1.3 }
};

export const minorScale = [0, 2, 3, 5, 7, 8, 10, 12];
const noteNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const degreeNames = ["Root", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Octave"];

export function tunings(fitting, relative = false) {
  const voice = fittings[fitting];
  if (voice.hits) return Object.entries(voice.hits).map(([value, label]) => ({ value, label }));
  if (!voice.sample) return [];
  return minorScale.map((step, i) => {
    const value = voice.root + step;
    return { value, label: relative ? degreeNames[i] : noteNames[value % 12] + (Math.floor(value / 12) - 1) };
  });
}
