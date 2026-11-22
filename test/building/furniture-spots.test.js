import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { FurnitureSpots } from "../../web/building/furniture-spots.js";
import { readHouse, houseFromLink, houseLink } from "../../web/library/house-format.js";
import { Score } from "../../web/music/score.js";

function parlour() {
  const editor = new HouseEditor();
  editor.drawRoom({x:0,z:0},{x:12,z:8});
  const shelf = editor.place("shelf",{x:2,z:2});
  return { editor, shelf };
}

test("a shelf of objects stays silent until a fitting is chosen", () => {
  const {editor,shelf} = parlour();
  const bell = editor.placeOn(shelf.id,"bell",0);
  editor.placeOn(shelf.id,"bottle",5);
  assert.deepEqual(Score.from(editor.house).events,[]);
  assert.throws(() => editor.moveOn(bell.id,5),/empty/);
  assert.throws(() => editor.placeOn(shelf.id,"clock",2),/small/);
  assert.throws(() => editor.place("orrery",{x:5,z:2}),/table or shelf/);
  editor.fitPiece(bell.id,"glass");
  assert.equal(Score.from(editor.house).events.filter(n => n.pieceId === bell.id).length,1);
  editor.fitPiece(bell.id,"plain");
  assert.deepEqual(Score.from(editor.house).events,[]);
});

test("the sweep plays the object's spot as its shelf moves and turns", () => {
  const {editor,shelf} = parlour();
  const bell = editor.placeOn(shelf.id,"bell",0);
  editor.setBand(false);
  editor.fitPiece(bell.id,"wire");
  editor.tune(bell.id,65);
  const beat = () => Score.from(editor.house).events[0].beat;
  assert.ok(Math.abs(beat()-2.39) < 1e-6);
  editor.moveOn(bell.id,2);
  assert.ok(Math.abs(beat()-3.61) < 1e-6);
  editor.rotate(shelf.id);
  assert.ok(Math.abs(beat()-2.39) < 1e-6);
  editor.move(shelf.id,{x:5,z:1});
  assert.ok(Math.abs(beat()-5.39) < 1e-6);
  assert.equal(Score.from(editor.house).events[0].pieceId,bell.id);
  assert.deepEqual(houseFromLink(houseLink(editor.house,"https://example.com/")),editor.house);
});

test("a copied shelf holds its own objects", () => {
  const {editor,shelf} = parlour();
  const book = editor.placeOn(shelf.id,"grimoire",3);
  const copy = editor.duplicate(shelf.id,{x:7,z:2});
  const copied = copy.contents[0];
  assert.notEqual(copied.id,book.id);
  editor.fitPiece(copied.id,"thorn");
  editor.remove(book.id);
  assert.equal(editor.house.pieces[0].contents,undefined);
  editor.undo();
  assert.equal(editor.house.pieces[0].contents[0].fitting,undefined);
  const house = editor.house;
  editor.remove(copy.id);
  editor.undo();
  assert.equal(editor.house,house);
});

test("shared houses reject duplicate object IDs and occupied or missing spots", () => {
  const {editor,shelf} = parlour();
  editor.placeOn(shelf.id,"bell",0);
  for (const entry of [{id:shelf.id,kind:"bell",slot:1},{id:"b",kind:"bell",slot:0},{id:"b",kind:"bell",slot:12}]) {
    const copy = structuredClone(editor.house);
    copy.pieces[0].contents.push(entry);
    assert.throws(() => readHouse(copy));
  }
  assert.equal(FurnitureSpots.slots("table").length,3);
});
