import test from "node:test";
import assert from "node:assert/strict";
import { HouseEditor } from "../../web/building/house-editor.js";
import { nightGarden } from "../../web/houses/night-garden.js";
import { arrangements, recordingFor } from "../../web/music/arrangements.js";
import { Score } from "../../web/music/score.js";
import { houseFromLink, houseLink } from "../../web/library/house-format.js";

function room(width = 8) {
  const editor = new HouseEditor();
  editor.drawRoom({ x: 0, z: 0 }, { x: width, z: 6 });
  return editor;
}

test("one wardrobe gets a four-beat riff, bass and drums wherever it is placed", () => {
  const editor = room(20);
  const piece = editor.place("wardrobe", { x: 10.24, z: 2 });
  const score = Score.from(editor.house);
  assert.deepEqual([score.left, score.beats], [8, 4]);
  assert.equal(editor.house.pieces[0].x, 10.24);
  assert.ok(score.events.filter(n => n.pieceId === piece.id).length >= 3);
  assert.ok(score.events.some(n => n.pieceId === piece.id && n.beat === 2));
  assert.deepEqual(new Set(score.events.map(n => n.recording)), new Set(["clavinet", "synth-bass", "machine-kick", "hat", "clap", "talkbox"]));
});

test("furnished bars follow the chords and leave a full empty bar quiet", () => {
  const editor = room(12);
  const left = editor.place("table", { x: 0, z: 0 });
  const right = editor.place("table", { x: 8, z: 0 });
  editor.setPhrase(left.id, "single");
  editor.setPhrase(right.id, "single");
  const { events } = Score.from(editor.house);
  assert.ok(!events.some(n => n.beat >= 4 && n.beat < 8));
  assert.deepEqual([left, right].map(p => events.find(n => n.pieceId === p.id).semitones), [0, 9]);
});

test("a bass fitting takes the bass line and a second drum fitting shares the kit", () => {
  const editor = room(4);
  const bass = editor.place("mirror", { x: 0, z: 3 });
  editor.place("lamp", { x: 0, z: 0 });
  editor.place("lamp", { x: 1, z: 1 }, "snare");
  const { events } = Score.from(editor.house);
  assert.ok(events.filter(n => n.sample === "bass").every(n => n.pieceId === bass.id));
  const drums = events.filter(n => ["kick", "snare", "hat"].includes(n.sample));
  assert.equal(new Set(drums.map(n => [n.sample, n.beat].join("/"))).size, drums.length);
  assert.ok(new Set(drums.map(n => n.velocity)).size > 1);
});

test("each arrangement gives the same room a different rhythm section and lead", () => {
  const editor = room(4);
  editor.place("sofa", { x: 0, z: 0 });
  const patterns = new Set(), leads = new Set();
  for (const mode of Object.keys(arrangements)) {
    editor.setMode(mode);
    const events = Score.from(editor.house).events;
    const kicks = events.filter(note => note.sample === "kick").map(note => note.beat);
    patterns.add(kicks.join("/"));
    leads.add(recordingFor(mode, "guitar"));
    assert.ok(events.every(note => Number.isFinite(note.semitones) && note.velocity > 0));
    if (mode === "chrome") assert.deepEqual(kicks, [0, 1, 2, 3]);
    if (mode === "landing") assert.deepEqual(events.filter(note => note.sample === "guitar").map(note => note.beat), [0.5, 1.5, 2.5, 3.5]);
  }
  assert.equal(patterns.size, 5);
  assert.equal(leads.size, 5);
});

test("turning the band off preserves the exact solo performance in a shared house", () => {
  const editor = room(8);
  editor.place("wardrobe", { x: 2.27, z: 2 });
  editor.setBand(false);
  const loaded = houseFromLink(houseLink(editor.house, "https://example.com/"));
  assert.deepEqual(Score.from(loaded).events.map(n => [n.beat, n.sample]), [[2.27, "guitar"]]);
  editor.undo();
  assert.ok(Score.from(editor.house).events.some(n => n.sample === "kick"));
});

test("stacked unisons share one attack and both pieces respond", () => {
  const editor = room(4);
  const a = editor.place("wardrobe", { x: 0.1, z: 0 });
  const b = editor.place("sofa", { x: 0.21, z: 3 });
  const attacks = Score.from(editor.house).events.filter(n => n.sample === "guitar" && n.beat === 0);
  assert.equal(attacks.length, 1);
  assert.deepEqual(new Set(attacks[0].together), new Set([a.id, b.id]));
});

test("a placed piece previews its actual bar and a catalogue piece auditions alone", () => {
  const editor = room(8);
  const sofa = editor.place("sofa", { x: 1.1, z: 1 });
  editor.place("lamp", { x: 5, z: 1 });
  const score = Score.from(editor.house);
  const bar = score.events.filter(note => note.beat < 4);
  const heard = score.preview(sofa);
  assert.deepEqual(heard.map(n => n.offset).sort((a, b) => a - b), bar.map(n => (n.beat + 3) % 4).sort((a, b) => a - b));
  assert.ok(heard.some(note => note.pieceId === sofa.id && note.offset === 0));
  assert.deepEqual(new Set(score.preview({ kind: "sofa", pitch: 50 }).map(n => n.sample)), new Set(["guitar"]));
});

test("returning to the house riff clears the manual phrase and survives a save", () => {
  const editor = room(4);
  const sofa = editor.place("sofa", { x: 0, z: 0 });
  editor.setPhrase(sofa.id, "single");
  assert.equal(Score.from(editor.house).events.filter(n => n.pieceId === sofa.id).length, 1);
  editor.setPhrase(sofa.id, null);
  const copy = houseFromLink(houseLink(editor.house, "https://example.com/"));
  assert.ok(!Object.hasOwn(copy.pieces[0], "phrase"));
  assert.ok(Score.from(copy).events.filter(n => n.pieceId === sofa.id).length > 1);
});

test("a single hand-picked note still gets a different answer on the next pass", () => {
  const editor = room(4);
  const sofa = editor.place("sofa", { x: 0, z: 0 });
  editor.setPhrase(sofa.id, "single");
  for (const mode of Object.keys(arrangements)) {
    editor.setMode(mode);
    const score = Score.from(editor.house);
    const take = pass => score.eventsFor(pass);
    assert.deepEqual(take(0).filter(e => e.pieceId === sofa.id), take(1).filter(e => e.pieceId === sofa.id));
    assert.notDeepEqual(take(0).filter(e => !e.pieceId), take(1).filter(e => !e.pieceId));
    assert.equal(take(2), take(0));
  }
});

test("the band plays its whole hook more softly under a furniture melody", () => {
  const editor = room(4);
  editor.place("lamp", { x: 0, z: 4 });
  const table = editor.place("table", { x: 1.5, z: 0 });
  editor.setPhrase(table.id, "single");
  editor.tune(table.id, 69);
  editor.styleRoom(table.roomId, { finish: "moonstone" });
  for (const mode of Object.keys(arrangements)) {
    editor.setMode(mode);
    const withTable = Score.from(editor.house);
    const kit = Score.from({ ...editor.house, pieces: editor.house.pieces.filter(p => p.id !== table.id) });
    for (const pass of [0, 1]) {
      const events = withTable.eventsFor(pass);
      const held = events.find(n => n.pieceId === table.id);
      assert.equal(held.finish, "moonstone");
      const hook = kit.eventsFor(pass).filter(n => !n.pieceId && !["ring", "stud"].includes(n.fitting));
      assert.ok(hook.length);
      for (const note of hook) {
        const reply = events.find(n => n.recording === note.recording && n.beat === note.beat && n.semitones === note.semitones);
        assert.equal(reply?.gate, note.gate, mode);
        assert.equal(reply.finish, undefined);
        const overlaps = note.beat < held.beat + held.gate && held.beat < note.beat + note.gate;
        if (overlaps) assert.ok(reply.velocity < note.velocity);
        else assert.equal(reply.velocity, note.velocity);
      }
    }
  }
});

test("shelf objects play their notes over both bars of each arrangement", () => {
  const editor = room(4);
  editor.place("sofa", { x: 0, z: 0 });
  const shelf = editor.place("shelf", { x: 0.5, z: 3 });
  const bare = editor.house;
  const instruments = ["thorn", "ring", "glass", "stud", "wire"];
  const objects = instruments.map((fitting, slot) => {
    const item = editor.placeOn(shelf.id, "bell", slot);
    return editor.fitPiece(item.id, fitting);
  });
  editor.tune(objects[1].id, 45);
  for (const mode of Object.keys(arrangements)) {
    const band = Score.from({ ...bare, mode });
    const furnished = Score.from({ ...editor.house, mode });
    for (const pass of [0, 1]) {
      const events = furnished.eventsFor(pass);
      for (const note of band.eventsFor(pass)) {
        const hit = events.find(n => n.beat === note.beat && n.recording === note.recording && n.semitones === note.semitones);
        assert.deepEqual(hit && [hit.gate, hit.velocity, hit.finish], [note.gate, note.velocity, note.finish], mode);
      }
      for (const item of objects) {
        const heard = furnished.preview(item, pass);
        assert.equal(heard.length, 1);
        assert.ok(heard[0].pieceId === item.id || heard[0].together?.includes(item.id));
      }
    }
  }
});

test("a bell can double a drum hit or play a second bass pitch on the same beat", () => {
  const editor = room(4);
  editor.place("lamp", { x: 0, z: 0 });
  const shelf = editor.place("shelf", { x: 0.5, z: 3 });
  editor.styleRoom(shelf.roomId, { finish: "moonstone" });
  const plain = Score.from(editor.house);
  const drum = editor.fitPiece(editor.placeOn(shelf.id, "bell", 0).id, "stud");
  const bass = editor.fitPiece(editor.placeOn(shelf.id, "bottle", 1).id, "ring");
  editor.tune(bass.id, 45);
  const score = Score.from(editor.house);
  const kicks = score.events.filter(n => n.beat === 1 && n.sample === "kick");
  assert.equal(kicks.length, 1);
  assert.ok(kicks[0].together.includes(drum.id));
  const lowNotes = score.events.filter(n => n.beat === 1.5 && n.sample === "bass");
  const original = plain.events.find(n => n.beat === 1.5 && n.sample === "bass");
  assert.ok(lowNotes.some(n => n.semitones === original.semitones && n.velocity === original.velocity));
  const extra = lowNotes.find(n => n.pieceId === bass.id);
  assert.equal(extra.semitones, 7);
  assert.equal(extra.finish, "moonstone");
  assert.ok(extra.gate <= 0.5 && extra.velocity < original.velocity);
});

test("Night Garden trades furniture melodies over a disco kick or a half-time snare", () => {
  for (const mode of ["chrome", "moth"]) {
    const score = Score.from({ ...nightGarden, mode });
    const melody = score.events.filter(n => n.pieceId && n.fitting !== "ring" && n.fitting !== "stud");
    for (const note of melody) {
      const sounding = melody.filter(n => n.beat <= note.beat && note.beat < n.beat + n.gate);
      assert.equal(new Set(sounding.map(n => n.recording)).size, 1);
    }
    const sample = mode === "chrome" ? "kick" : "snare";
    const hits = score.events.filter(n => n.sample === sample).map(n => n.beat);
    assert.deepEqual(hits, mode === "chrome" ? [0, 1, 2, 3, 4, 5, 6, 7] : [2, 6]);
    const players = [...new Set(score.events.map(n => n.pieceId).filter(Boolean))];
    assert.deepEqual(players.map(id => nightGarden.pieces.find(p => p.id === id).kind).sort(), ["bookcase", "lamp", "table"]);
  }
});

test("an arrangement audition opens on the downbeat and includes the one-bar house's reply", () => {
  const editor = room(4);
  editor.place("sofa", { x: 1, z: 0 });
  const score = Score.from(editor.house);
  const opening = score.opening();
  for (const pass of [0, 1]) {
    const offsets = opening.filter(n => Math.floor(n.offset / 4) === pass).map(n => n.offset);
    assert.deepEqual(offsets, score.eventsFor(pass).map(n => n.beat + 4 * pass));
    assert.equal(offsets[0], 4 * pass);
  }
});
