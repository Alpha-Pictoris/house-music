import { fittings } from "./fittings.js";

export const tablesAndShelves = "Tables & shelves";

export const furniture = {
  hourglass: { label: "Rising hourglass", width: 1.10, depth: 1.10, height: 2.05, fitting: "plain" },
  mothlight: { label: "Moth lantern", width: 1.55, depth: 1.40, height: 2.32, fitting: "plain" },
  threshold: { label: "Elsewhere door", width: 1.65, depth: 0.80, height: 2.72, fitting: "plain" },
  monitor: { label: "Dead monitor", width: 0.95, depth: 0.85, height: 1.12, fitting: "plain" },
  sofa:     { label: "Velvet sofa",   group: "Living",   width: 2.5,  depth: 1.2,  height: 1.45, fitting: "thorn", phrase: "answer" },
  table:    { label: "Dining set",    group: "Living",   width: 2.1,  depth: 1.8,  height: 1.35, fitting: "glass", phrase: "arch" },
  bookcase: { label: "Bookcase",      group: "Living",   width: 1.65, depth: 0.65, height: 2.65, fitting: "wire", phrase: "fall" },
  lamp:     { label: "Lamp",          group: "Living",   width: 1,    depth: 1,    height: 2.3,  fitting: "stud", light: true },
  chair:    { label: "Wingback chair", group: "Living", width: 1.12, depth: 1.04, height: 1.68, fitting: "plain" },
  console:  { label: "Crescent console", group: tablesAndShelves, width: 2.25, depth: 0.82, height: 1.17, fitting: "plain" },
  shelf:    { label: "Curio shelf", group: tablesAndShelves, width: 2, depth: 0.7, height: 2.25, fitting: "plain" },
  clock:    { label: "Longcase clock", group: "Decor", width: 0.84, depth: 0.66, height: 2.5, fitting: "plain" },
  bed:      { label: "Bed",           group: "Bedroom",  width: 2.05, depth: 2.9,  height: 1.7,  fitting: "wire", phrase: "rise" },
  wardrobe: { label: "Wardrobe",      group: "Bedroom",  width: 1.85, depth: 1,    height: 3.1,  fitting: "thorn" },
  mirror:   { label: "Mirror",        group: "Bedroom",  width: 1.45, depth: 0.65, height: 2.7,  fitting: "ring" },
  stove:    { label: "Kitchen range", group: "Fixtures", width: 1.35, depth: 1.05, height: 1.65, fitting: "stud", phrase: "answer" },
  tub:      { label: "Clawfoot bath", group: "Fixtures", width: 2,    depth: 1.05, height: 1,    fitting: "ring", phrase: "fall" },
  window:   { label: "Lancet window", group: "Fixtures", width: 1.4,  depth: 0.18, height: 2.5,  fitting: "plain", layer: "wall" },
  rug:      { label: "Woven rug",     group: "Decor",    width: 2.5,  depth: 1.7,  height: 0.06, fitting: "plain", layer: "floor" },
  fern:     { label: "Potted fern",   group: "Decor",    width: 1,    depth: 1,    height: 1.4,  fitting: "plain" },
  tree:     { label: "Crooked tree",  group: "Garden",   width: 2,    depth: 2,    height: 3.25, fitting: "plain", garden: true },
  path:     { label: "Flagstone",     group: "Garden",   width: 1,    depth: 1,    height: 0.08, fitting: "plain", garden: true, layer: "floor" },
  bottle:   { label: "Moon bottle", layer: "tabletop", width: 0.32, depth: 0.32, height: 0.50, fitting: "plain", phrase: "single" },
  grimoire: { label: "Little grimoire", layer: "tabletop", width: 0.40, depth: 0.31, height: 0.15, fitting: "plain", phrase: "single" },
  bell:     { label: "Handbell", layer: "tabletop", width: 0.32, depth: 0.32, height: 0.47, fitting: "plain", phrase: "single" },
  orrery:   { label: "Pocket orrery", layer: "tabletop", width: 0.42, depth: 0.38, height: 0.49, fitting: "plain", phrase: "single" },
  fountain: { label: "Fountain",      group: "Garden",   width: 1.65, depth: 1.65, height: 1.5,  fitting: "plain", garden: true }
};

export const roomFinishes = {
  walnut: { label: "Walnut & damask", sound: "Warm and dry" },
  moonstone: { label: "Moonstone tile", sound: "A bright, short echo" },
  moss: { label: "Moss carpet", sound: "Soft and close" }
};

export const fittingOf = piece => piece.fitting ?? furniture[piece.kind].fitting;
export const phraseOf = piece => piece.phrase ?? furniture[piece.kind].phrase ?? "single";
export const isSmallObject = kind => typeof kind === "string" && furniture[kind]?.layer === "tabletop";

export function newPiece(kind) {
  if (!Object.hasOwn(furniture, kind)) throw Error("Choose a piece from the catalogue.");
  const instrument = fittings[furniture[kind].fitting];
  const tuning = instrument.hits ? { hit: "kick" } : instrument.sample ? { pitch: instrument.root } : {};
  return { kind, turn: 0, ...tuning };
}
