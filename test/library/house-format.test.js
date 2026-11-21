import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { readHouse, houseLink, houseFromLink, houseText } from "../../web/library/house-format.js";

function furnishedHouse() {
  const editor = new HouseEditor();
  editor.rename("夜の家 ♫ 🏠");
  editor.setMode("landing");
  editor.drawRoom({ x: 0, z: 0 }, { x: 6, z: 4 });
  editor.drawRoom({ x: 6, z: 0 }, { x: 10, z: 4 });
  editor.addDoor({ x: 6, z: 2 });
  editor.place("wardrobe", { x: 1, z: 1 }, 55);
  editor.place("lamp", { x: 7, z: 2 }, "snare");
  return editor.house;
}

test("reading a house makes a fresh record with only model fields", () => {
  const house = furnishedHouse();
  const copy = readHouse({ ...house, extra: true, rooms: house.rooms.map(room => ({ ...room, extra: true })) });
  assert.deepEqual(copy, house);
  assert.notEqual(copy.pieces[0], house.pieces[0]);
  assert.notEqual(copy.doors[0].rooms, house.doors[0].rooms);
});

test("a piece must belong to an existing room", () => {
  const house = structuredClone(furnishedHouse());
  house.pieces[0].roomId = "missing";
  assert.throws(() => readHouse(house), /room/i);
});

test("IDs must be unique across the house", () => {
  const house = structuredClone(furnishedHouse());
  house.pieces[0].id = house.rooms[0].id;
  assert.throws(() => readHouse(house), /id/i);
});

test("prototype names and invalid tunings are rejected", () => {
  const house = structuredClone(furnishedHouse());
  assert.throws(() => readHouse({ ...house, mode: "constructor" }), /arrangement/i);
  house.pieces[0].kind = "__proto__";
  assert.throws(() => readHouse(house), /furniture/i);
  house.pieces[0].kind = "wardrobe";
  house.pieces[0].pitch = 51;
  assert.throws(() => readHouse(house), /note|tuning/i);
});

test("room geometry must fit the plot", () => {
  const house = structuredClone(furnishedHouse());
  house.rooms[0].width = 257;
  assert.throws(() => readHouse(house), /plot/i);
});

test("files and share links preserve the same Unicode house", () => {
  const house = furnishedHouse();
  const link = houseLink(house, "http://localhost:8080/game/#old");
  assert.match(link, /^http:\/\/localhost:8080\/game\/#h=[A-Za-z0-9_-]+$/);
  assert.deepEqual(houseFromLink(link), house);
  assert.deepEqual(readHouse(JSON.parse(houseText(house))), house);
});

test("a truncated link reports a readable error", () => {
  const link = houseLink(furnishedHouse(), "https://example.com/game/");
  assert.throws(() => houseFromLink(link.slice(0, -8)), /house link/i);
  assert.equal(houseFromLink("https://example.com/game/#other"), null);
});

test("opening a saved arrangement preserves the house and its fittings", () => {
  const house = furnishedHouse();
  for (const [from, to] of [["goth", "moth"], ["nightcore", "chrome"]]) {
    assert.deepEqual(readHouse({ ...house, mode: from }), { ...house, mode: to });
  }
});
