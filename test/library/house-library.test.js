import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { HouseLibrary } from "../../web/library/house-library.js";

const key = "house-music.library";

function memoryStorage() {
  const records = new Map();
  return {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value)
  };
}

test("an empty plot resumes after reload and an empty library does not write", () => {
  const storage = memoryStorage();
  const library = new HouseLibrary(storage);
  assert.equal(library.current(), null);
  assert.deepEqual(library.list(), []);
  assert.equal(storage.getItem(key), null);

  const house = new HouseEditor().house;
  const id = library.save(null, house);
  assert.deepEqual(new HouseLibrary(storage).current(), { id, house });
});

test("same-title copies remain independent and opening one makes it active", () => {
  const storage = memoryStorage();
  const library = new HouseLibrary(storage);
  const editor = new HouseEditor();
  const first = library.save(null, editor.house);
  editor.setMode("nightcore");
  const second = library.save(null, editor.house);
  assert.notEqual(first, second);
  assert.deepEqual(library.list(), [first, second].map(id => ({ id, title: "Untitled house" })));
  assert.equal(library.open(first).house.mode, "goth");
  assert.equal(new HouseLibrary(storage).current().id, first);
  assert.equal(library.open(second).house.mode, "nightcore");
});

test("a failed write preserves both the saved bytes and the playable edit", () => {
  const storage = memoryStorage();
  const library = new HouseLibrary(storage);
  const editor = new HouseEditor();
  const id = library.save(null, editor.house);
  const saved = storage.getItem(key);

  editor.rename("An edited house");
  storage.setItem = () => { throw Error("quota"); };
  assert.throws(() => library.save(id, editor.house), /save/i);
  assert.equal(storage.getItem(key), saved);
  assert.equal(editor.house.title, "An edited house");
});

test("saving from a stale tab preserves newly added houses", () => {
  const storage = memoryStorage();
  const firstTab = new HouseLibrary(storage);
  const secondTab = new HouseLibrary(storage);
  const editor = new HouseEditor();
  const first = firstTab.save(null, editor.house);
  const second = secondTab.save(null, editor.house);

  editor.rename("Revised");
  firstTab.save(first, editor.house);
  assert.equal(firstTab.current().house.title, "Revised");
  assert.equal(firstTab.open(second).house.title, "Untitled house");
});

test("corrupted and unavailable storage report errors without replacing saves", () => {
  const storage = memoryStorage();
  storage.setItem(key, "{broken");
  const library = new HouseLibrary(storage);
  assert.throws(() => library.current(), /read/i);
  assert.throws(() => library.save(null, new HouseEditor().house), /read/i);
  assert.equal(storage.getItem(key), "{broken");
  assert.throws(() => new HouseLibrary(null).current(), /storage/i);
});
