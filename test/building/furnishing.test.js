import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { houseFromLink, houseLink } from "../../web/library/house-format.js";
import { Score } from "../../web/music/score.js";

function sittingRoom() {
  const editor = new HouseEditor();
  const room = editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  return { editor, room };
}

test("a sofa stands on a rug while other solid furniture needs its own space", () => {
  const { editor } = sittingRoom();
  editor.place("rug", { x: 1, z: 1 });
  editor.place("sofa", { x: 1, z: 1 });
  assert.throws(() => editor.place("bed", { x: 1, z: 1 }));
  assert.equal(editor.house.pieces.length, 2);
});

test("garden pieces belong outside and a room cannot cover a tree", () => {
  const { editor } = sittingRoom();
  const tree = editor.place("tree", { x: 9, z: 1 });
  assert.equal(tree.roomId, null);
  assert.throws(() => editor.move(tree.id, { x: 7, z: 1 }));
  assert.throws(() => editor.drawRoom({ x: 8, z: 0 }, { x: 12, z: 5 }));
  assert.deepEqual(Score.from(editor.house).events, []);
});

test("a window snaps to an outside wall and survives a round trip", () => {
  const { editor, room } = sittingRoom();
  const window = editor.place("window", { x: 0.1, z: 3 });
  assert.equal(window.roomId, room.id);
  assert.equal(window.turn, 1);
  assert.throws(() => editor.move(window.id, { x: 4, z: 3 }));
  assert.throws(() => editor.drawRoom({ x: -3, z: 0 }, { x: 0, z: 6 }));
  assert.deepEqual(houseFromLink(houseLink(editor.house, "https://example.com/")), editor.house);
});

test("room finishes and fittings travel with a furnished house", () => {
  const { editor, room } = sittingRoom();
  editor.styleRoom(room.id, { name: "Winter kitchen", finish: "moonstone" });
  const table = editor.place("table", { x: 2, z: 2 });
  editor.fitPiece(table.id, "thorn");
  editor.setPhrase(table.id, "rise");
  const score = Score.from(editor.house);
  const part = score.events.filter(note => note.pieceId === table.id);
  assert.deepEqual(part.map(note => [note.sample, note.beat]), [["guitar", 2], ["guitar", 2.5], ["guitar", 3]]);
  assert.equal(new Set(part.map(note => note.semitones)).size, 3);
  assert.ok(part.every(note => note.finish === "moonstone"));
  assert.deepEqual(houseFromLink(houseLink(editor.house, "https://example.com/")), editor.house);
  editor.fitPiece(table.id, "plain");
  assert.equal(Score.from(editor.house).events.length, 0);
  editor.undo();
  assert.deepEqual(Score.from(editor.house).events, score.events);
});
