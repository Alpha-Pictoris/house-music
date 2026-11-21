import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { Transport } from "../../web/music/transport.js";

function rehearsal(x = 0) {
  let now = 0;
  const notes = [];
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: 4, z: 4 });
  editor.place("lamp", { x, z: 0 });
  const sink = {
    start(event, time) { notes.push({ id: event.pieceId, time }); },
    cancelFrom(time) {
      for (let i = notes.length - 1; i >= 0; i--) if (notes[i].time >= time) notes.splice(i, 1);
    }
  };
  const transport = new Transport(() => now, sink);
  transport.setHouse(editor.house);
  return { editor, transport, notes, advance(time) { now = time; transport.tick(); } };
}

test("aligned instruments play together and the next downbeat plays once", () => {
  const { editor, transport, notes, advance } = rehearsal();
  editor.place("mirror", { x: 0, z: 2 });
  transport.setHouse(editor.house);
  transport.play();
  advance(1.81);
  advance(1.86);
  advance(1.88);
  assert.deepEqual(notes.map(n => n.time), [0, 0, 1.875, 1.875]);
});

test("switching to nightcore keeps the beat and replaces a queued note", () => {
  const { transport, notes, advance } = rehearsal(1);
  transport.play();
  advance(0.4);
  const beat = transport.view().beat;
  transport.setMode("nightcore");
  assert.equal(transport.view().beat, beat);
  assert.equal(notes.length, 1);
  assert.ok(Math.abs(notes[0].time - (0.4 + (1 - beat) * 0.375)) < 1e-8);
});

test("a longer draft takes over exactly at the old loop boundary", () => {
  const { editor, transport, notes, advance } = rehearsal();
  transport.play();
  advance(1.8);
  editor.drawRoom({ x: 4, z: 0 }, { x: 8, z: 4 });
  transport.setHouse(editor.house);
  assert.equal(transport.view().beats, 4);
  advance(1.875);
  assert.equal(transport.view().beats, 8);
  assert.deepEqual(notes.map(n => n.time), [0, 1.875]);
});

test("pause cancels future starts and resume keeps the floor position", () => {
  const { transport, notes, advance } = rehearsal(1);
  transport.play();
  advance(0.4);
  transport.pause();
  const x = transport.view().sweepX;
  assert.equal(notes.length, 0);
  advance(3);
  transport.play();
  assert.ok(Math.abs(transport.view().sweepX - x) < 1e-8);
});
