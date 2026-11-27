import test from "node:test";
import assert from "node:assert/strict";
import { BSide } from "../../web/building/b-side.js";
import { HouseEditor } from "../../web/building/house-editor.js";
import { Score } from "../../web/music/score.js";
import { Transport } from "../../web/music/transport.js";

function bedroom(band = false) {
  const editor = new HouseEditor();
  editor.setBand(band);
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const wardrobe = editor.place("wardrobe", { x: 1, z: 0 });
  editor.place("lamp", { x: 3.5, z: 0 }, "snare");
  editor.place("rug", { x: 4, z: 3 });
  return { editor, wardrobe };
}

const heard = (score, pass = 0) => score.eventsFor(pass).map(event => [event.sample, event.beat]);
const reply = (score, pass) => score.eventsFor(pass).filter(event => event.pieceId === BSide.monitorId);

test("a house plays one side until a shadow is moved, then the two sides take turns", () => {
  const { editor, wardrobe } = bedroom();
  const before = Score.from(editor.house);
  assert.deepEqual([0, 1].map(pass => before.sideOf(pass)), [0, 0]);
  assert.deepEqual(heard(before, 1), [["guitar", 1], ["snare", 3.5]]);

  editor.moveShadow(wardrobe.id, { x: 6, z: 3 });
  const score = Score.from(editor.house);
  assert.deepEqual([0, 1, 2, 3].map(pass => score.sideOf(pass)), [0, 1, 0, 1]);
  assert.deepEqual(heard(score, 0), [["guitar", 1], ["snare", 3.5]]);
  assert.deepEqual(heard(score, 1), [["snare", 3.5], ["guitar", 6]]);
  editor.undo();
  assert.deepEqual(heard(Score.from(editor.house), 1), [["guitar", 1], ["snare", 3.5]]);
});

test("a moved shadow changes nothing in a house with no way to its B-side", () => {
  const editor = new HouseEditor();
  editor.setBand(false);
  editor.drawRoom({ x: 0, z: 0 }, { x: 8, z: 6 });
  const wardrobe = editor.place("wardrobe", { x: 1, z: 0 });
  editor.moveShadow(wardrobe.id, { x: 6, z: 3 });
  assert.deepEqual(heard(Score.from(editor.house), 1), [["guitar", 1]]);
});

test("objects on a shelf play on the A-side only", () => {
  const { editor } = bedroom();
  const shelf = editor.place("bookcase", { x: 5, z: 0 });
  const bell = editor.placeOn(shelf.id, "bell", 1);
  editor.fitPiece(bell.id, "glass");
  editor.moveShadow(shelf.id, { x: 1, z: 4 });
  const score = Score.from(editor.house);
  assert.ok(score.eventsFor(0).some(event => event.pieceId === bell.id));
  assert.ok(!score.eventsFor(1).some(event => event.pieceId === bell.id));
  assert.equal(score.eventsFor(1).find(event => event.pieceId === shelf.id).beat, 1);
});

test("the house band seats a moved shadow on the nearest half beat of the B-side", () => {
  const { editor, wardrobe } = bedroom(true);
  const riff = pass => Score.from(editor.house).eventsFor(pass).filter(event => event.pieceId === wardrobe.id).map(event => event.beat);
  editor.move(wardrobe.id, { x: 2.5, z: 3 });
  const seated = riff(0);
  editor.move(wardrobe.id, { x: 1, z: 0 });
  editor.moveShadow(wardrobe.id, { x: 2.3, z: 3 });
  assert.notDeepEqual(riff(0), seated);
  assert.deepEqual(riff(1), seated);
});

test("three falling tones answer a B-side that leaves its last two beats clear", () => {
  const { editor, wardrobe } = bedroom();
  editor.moveShadow(wardrobe.id, { x: 6.1, z: 0 });
  assert.deepEqual(reply(Score.from(editor.house), 1), []);

  editor.moveShadow(wardrobe.id, { x: 2, z: 3 });
  const score = Score.from(editor.house);
  const tones = reply(score, 1);
  assert.deepEqual(tones.map(event => event.beat), [6.5, 7, 7.5]);
  assert.ok(tones[0].semitones > tones[1].semitones && tones[1].semitones > tones[2].semitones);
  assert.deepEqual(reply(score, 0), []);
});

test("a one-bar band house answers on both of its B-side turns", () => {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 4, z: 6 });
  const mirror = editor.place("mirror", { x: 1.5, z: 0.2 });
  editor.place("fern", { x: 0.2, z: 0.2 });
  editor.place("rug", { x: 1, z: 3 });
  const lamp = editor.place("lamp", { x: 2.9, z: 1.5 });
  editor.fitPiece(lamp.id, "plain");
  editor.moveShadow(mirror.id, { x: 0.5, z: 1.5 });
  const score = Score.from(editor.house);
  assert.deepEqual([0, 1, 2, 3].map(pass => score.sideOf(pass)), [0, 1, 0, 1]);
  for (const pass of [1, 3]) assert.equal(reply(score, pass).length, 3);
  assert.notDeepEqual(score.eventsFor(0), score.eventsFor(2));
});

test("the transport reports the sounding side and lights the monitor on its reply", () => {
  const { editor, wardrobe } = bedroom();
  editor.moveShadow(wardrobe.id, { x: 2, z: 3 });
  let now = 0;
  const transport = new Transport(() => now, { start() {}, cancelFrom() {} });
  transport.setHouse(editor.house);
  transport.play();
  const beat = 60 / 128;
  assert.equal(transport.view().flipped, false);
  for (now = 0; now < 15.6 * beat; now += 0.05) transport.tick();
  now = 15.6 * beat;
  transport.tick();
  const view = transport.view();
  assert.equal(view.flipped, true);
  assert.ok(view.levels.get(BSide.monitorId) > 0);
  assert.deepEqual(transport.preview(wardrobe, true).map(note => note.sample), ["guitar"]);
});
