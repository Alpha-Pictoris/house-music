import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { readHouse } from "../../web/library/house-format.js";
import { Score } from "../../web/music/score.js";
import { CurioArt, curioModels } from "../../web/scene/curios.js";

test("curiosities move with the sweep, stay still with reduced motion and sound when fitted", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 10, z: 4 });
  for (const [i, kind] of Object.keys(curioModels).entries()) {
    const piece = editor.place(kind, { x: 3*i, z: 1 });
    const pose = (sweepX, motion) => {
      const items = [];
      CurioArt.append(items, piece, [piece.x,0,1], 0, { sweepX, pose: motion });
      return items.map(({ origin, turn, scale, opacity }) => [origin, turn, scale, opacity]);
    };
    assert.notDeepEqual(pose(0.3,1), pose(1.6,1));
    assert.deepEqual(pose(0.3,0), pose(1.6,0));
  }
  assert.deepEqual(Score.from(editor.house).events, []);
  for (const piece of editor.house.pieces) editor.fitPiece(piece.id, "glass");
  const house = readHouse(editor.house);
  for (const piece of house.pieces) assert.ok(Score.from(house).events.some(note => note.pieceId === piece.id));
});
