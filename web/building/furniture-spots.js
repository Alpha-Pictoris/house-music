import { furniture, isSmallObject } from "./catalogue.js";
import { FloorPlan } from "./floor-plan.js";

const row = (y, z, spread, tier = "") => ["Left", "Centre", "Right"].map((name, i) => ({
  label: tier ? tier + " " + name.toLowerCase() : name, x: (i - 1) * spread, y, z
}));

const spots = {
  table: row(1.045, 0.08, 0.50),
  bookcase: row(2.617, -0.03, 0.57),
  console: row(1.105, 0.02, 0.72),
  shelf: [...row(0.64, 0.04, 0.61, "Lower"), ...row(1.45, 0.04, 0.61, "Upper")]
};

export const quarterTurns = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export class FurnitureSpots {
  static slots(kind) { return spots[kind] ?? []; }

  static checkSlot(kind, slot) {
    if (!Number.isInteger(slot) || !this.slots(kind)[slot]) throw Error("Choose a spot on the table or shelf.");
  }

  static check(parent, slot) {
    this.checkSlot(parent.kind, slot);
    if (parent.contents?.some(item => item.slot === slot)) throw Error("Choose an empty spot.");
  }

  static anchor(parent, slot) {
    const point = this.slots(parent.kind)[slot], box = FloorPlan.footprint(parent);
    const [cos, sin] = quarterTurns[parent.turn];
    return { x: box.x + box.width / 2 + cos * point.x + sin * point.z,
      y: point.y, z: box.z + box.depth / 2 - sin * point.x + cos * point.z };
  }

  static *placedPieces(pieces) {
    for (const parent of pieces) {
      yield parent;
      for (const item of parent.contents ?? []) yield { ...item, ...this.anchor(parent, item.slot), roomId: parent.roomId };
    }
  }

  static objects = Object.keys(furniture).filter(isSmallObject);
}
