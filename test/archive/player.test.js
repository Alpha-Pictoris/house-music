import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildArchive } from "../../scripts/build-archive.mjs";
import { houseLink } from "../../web/library/house-format.js";

test("the cassette stops a pending play when its tape changes", async t => {
  const output = await mkdtemp(join(tmpdir(), "cassette-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await buildArchive(output);
  await writeFile(join(output, "package.json"), '{"type":"module"}');
  const { TapePlayer } = await import(pathToFileURL(join(output, "player.js")));

  const controls = Object.fromEntries(["play", "action", "title", "name", "number", "status"].map(name =>
    ["[data-tape-" + name + "]", new EventTarget()]));
  const page = Object.assign(new EventTarget(), { location: new URL("https://archive.example/cases/041/") });
  const deck = {
    ownerDocument: Object.assign(new EventTarget(), { defaultView: page }),
    dataset: {}, querySelector: selector => controls[selector]
  };
  let enable;
  const notes = [];
  const player = new TapePlayer(deck, {
    now: 0, enable: () => new Promise(resolve => { enable = resolve; }),
    start: note => notes.push(note), cancelFrom() {}
  });
  t.after(() => player.pause());
  assert.equal(controls["[data-tape-title]"].textContent, "Reference copy");
  assert.equal(player.labelNumber.textContent, "EH/98/041a");
  const pending = player.toggle();
  const reference = player.transport.view().house;
  const drum = { id: "drum", kind: "lamp", roomId: "landing", x: 0, z: 0, turn: 0, hit: "kick" };
  const house = { ...reference, title: "The blue room", pieces: [drum] };
  player.open(houseLink(house, "https://house.example/"));
  enable();
  await pending;
  assert.equal(controls["[data-tape-title]"].textContent, "Deposited copy · The blue room");
  assert.equal(player.labelName.textContent, house.title);
  const number = player.labelNumber.textContent;
  assert.match(number, /^041a \/ [0-9A-F]{4}-[0-9A-F]{4}$/);
  player.open(houseLink({ ...house, band: true }, page.location));
  assert.notEqual(player.labelNumber.textContent, number);
  player.open(houseLink(house, page.location));
  assert.equal(player.labelNumber.textContent, number);
  assert.deepEqual(notes, []);

  const play = player.toggle();
  enable();
  await play;
  assert.equal(notes[0].sample, "kick");
  page.dispatchEvent(new Event("pagehide"));
  assert.equal(deck.dataset.state, "paused");

  player.open(page.location.href + "#h=broken");
  assert.equal(controls["[data-tape-play]"].disabled, true);
  assert.equal(player.labelNumber.textContent, "");
  assert.equal(player.labelName.textContent, "");
  assert.equal(controls["[data-tape-status]"].textContent, "Recording unavailable.");
  player.open(page.location.href);
  assert.equal(player.labelName.textContent, "Flat below");
  assert.equal(player.labelNumber.textContent, "EH/98/041a");
});
