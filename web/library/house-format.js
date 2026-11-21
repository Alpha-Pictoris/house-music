import { fittingOf, furniture, roomFinishes } from "../building/catalogue.js";
import { fittings, tunings } from "../building/fittings.js";
import { FloorPlan } from "../building/floor-plan.js";
import { arrangements } from "../music/arrangements.js";
import { phrases } from "../music/phrases.js";

function requireValid(condition, message) {
  if (!condition) throw Error(message);
}

function plainRecord(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function readHouse(value) {
  requireValid(plainRecord(value), "Choose a valid house file.");
  const { title, mode, rooms, doors, pieces } = value;
  requireValid(typeof title === "string" && title.trim() && title.length <= 100, "Use a house title of 1 to 100 characters.");
  requireValid(typeof mode === "string" && Object.hasOwn(arrangements, mode), "Choose a supported house arrangement.");
  requireValid([rooms, doors, pieces].every(Array.isArray), "The house must include rooms, doors and furniture lists.");

  const ids = new Set();
  function readId(item) {
    requireValid(plainRecord(item), "The house contains an unreadable item.");
    const { id } = item;
    requireValid(typeof id === "string" && id.trim() && !Object.hasOwn(Object.prototype, id), "The house contains an invalid item ID.");
    requireValid(!ids.has(id), "Each item in the house needs a unique ID.");
    ids.add(id);
    return id;
  }

  const house = { title, mode, rooms: [], doors: [], pieces: [] };
  for (const item of rooms) {
    const id = readId(item);
    const { x, z, width, depth } = item;
    const room = { id, x, z, width, depth };
    if (item.name !== undefined) {
      requireValid(typeof item.name === "string" && item.name.length <= 40, "Use a room name of up to 40 characters.");
      room.name = item.name;
    }
    if (item.finish !== undefined) {
      requireValid(typeof item.finish === "string" && Object.hasOwn(roomFinishes, item.finish), "Choose a known room finish.");
      room.finish = item.finish;
    }
    const error = FloorPlan.roomError(house, room);
    requireValid(!error, error);
    house.rooms.push(room);
  }

  const roomIds = new Set(house.rooms.map(room => room.id));
  for (const item of doors) {
    const id = readId(item);
    const { rooms: owners, x, z } = item;
    requireValid(Array.isArray(owners) && owners.length === 2 && owners[0] !== owners[1]
      && roomIds.has(owners[0]) && roomIds.has(owners[1]), "Each door needs two existing rooms.");
    const door = { id, rooms: [owners[0], owners[1]], x, z };
    const error = FloorPlan.doorError(house, door);
    requireValid(!error, error);
    house.doors.push(door);
  }

  for (const item of pieces) {
    const id = readId(item);
    const { kind, roomId, x, z, turn } = item;
    requireValid(typeof kind === "string" && Object.hasOwn(furniture, kind), "The house contains an unknown piece of furniture.");
    const design = furniture[kind];
    requireValid(design.garden ? roomId === null : roomIds.has(roomId), "Each indoor piece needs an existing room.");
    requireValid(Number.isFinite(x) && Number.isFinite(z) && Number.isInteger(turn) && turn >= 0 && turn < 4,
      "The house contains an invalid furniture position or turn.");
    const piece = { id, kind, roomId, x, z, turn };
    if (item.fitting !== undefined) {
      requireValid(!design.garden && typeof item.fitting === "string" && Object.hasOwn(fittings, item.fitting), "Choose an indoor fitting.");
      piece.fitting = item.fitting;
    }
    if (item.phrase !== undefined) {
      requireValid(!design.garden && typeof item.phrase === "string" && Object.hasOwn(phrases, item.phrase), "Choose a known musical phrase.");
      piece.phrase = item.phrase;
    }
    const fitting = fittingOf(piece);
    if (fitting !== "plain") {
      const tuning = fittings[fitting].hits ? "hit" : "pitch";
      requireValid(tunings(fitting).some(option => option.value === item[tuning]), "Choose a note or drum hit from the catalogue.");
      piece[tuning] = item[tuning];
    }
    const error = FloorPlan.pieceError(house, piece);
    requireValid(!error, error);
    house.pieces.push(piece);
  }
  return house;
}

export function houseText(house) {
  return JSON.stringify(readHouse(house));
}

export function houseLink(house, baseURL) {
  const url = new URL(baseURL);
  let bytes = "";
  for (const byte of new TextEncoder().encode(houseText(house))) bytes += String.fromCharCode(byte);
  const encoded = btoa(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  url.hash = "h=" + encoded;
  return url.href;
}

export function houseFromLink(url) {
  const fragments = new URLSearchParams(new URL(url).hash.slice(1)).getAll("h");
  if (fragments.length === 0) return null;

  let value;
  try {
    const [encoded] = fragments;
    if (fragments.length !== 1 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw Error();
    const bytes = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    const json = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes, char => char.charCodeAt(0)));
    value = JSON.parse(json);
  } catch {
    throw Error("This house link could not be read. Ask for a fresh link or a house file.");
  }
  return readHouse(value);
}
