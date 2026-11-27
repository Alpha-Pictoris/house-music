import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildArchive } from "../../scripts/build-archive.mjs";
import { referencePath } from "../../archive/file-references.js";
import { RecordOffice } from "../../archive-worker/record-office.js";
import { PublishedPages } from "../../scripts/archive-stand-ins.mjs";

test("the case ships with its own navigation, playback modules and credited recordings", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portsmouth-archive-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "package.json"), '{"type":"module"}');
  const output = join(directory, "site");
  await buildArchive(output);

  const page = await readFile(join(output, referencePath("EH/98/041"), "index.html"), "utf8");
  assert.match(page, /<header\b/);
  assert.match(page, /<footer\b/);
  assert.doesNotMatch(page, /<!-- archive-(?:header|footer) -->/);
  assert.ok(!(await readdir(output)).includes("_layout"));
  const catalogue = await readFile(join(output, "index.html"), "utf8");
  assert.match(catalogue, /href="\/records\/harbour-print\/"/);
  assert.doesNotMatch(catalogue, /Rigger’s Yard|EH\/98\/041|BS\/82\/016|RO\/98\/012|HO\/78\/017|AV\/98\/019/);
  const shortcuts = { "EH/98/041": "cases/041", "HO/78/017": "cases/017", "BS/82/016": "records/landing", "RO/98/012": "records/deposits",
    "AV/98/019": "records/videotape" };
  for (const [reference, shortcut] of Object.entries(shortcuts)) {
    const detail = await readFile(join(output, referencePath(reference), "index.html"), "utf8");
    assert.ok(detail.includes(reference));
    assert.match(detail, /name="robots" content="noindex, nofollow"/);
    assert.doesNotMatch(detail, /href="\/(?:cases|records)\//);
    const redirect = await readFile(join(output, shortcut, "index.html"), "utf8");
    assert.match(redirect, /location\.replace\("\/" \+ location\.hash\)/);
    assert.ok(!redirect.includes(reference));
  }
  const print = await readFile(join(output, "records/harbour-print/index.html"), "utf8");
  assert.match(print, /\/assets\/harbour\.webp/);
  const credits = await readFile(join(output, "docs/puzzles/archive-credits.md"), "utf8");
  assert.match(credits, /Frank Wen/);
  assert.match(credits, /Government Digital Service/);
  assert.match(credits, /permission notice shall be included/);
  const theme = await readFile(join(output, "govuk.css"), "utf8");
  assert.match(theme, /\.govuk-generic-header[ {]/);
  assert.match(theme, /--govuk-brand-colour:\s*#142e3a/i);

  const moduleAt = name => import(pathToFileURL(join(output, "house", name)));
  await Promise.all(["library/house-format.js", "music/sampler.js", "music/transport.js"].map(moduleAt));
  const { recordingNames } = await moduleAt("music/arrangements.js");
  for (const name of Object.keys(recordingNames)) {
    const wav = await readFile(join(output, "house/audio", name + ".wav"));
    assert.equal(wav.toString("ascii", 0, 4), "RIFF", name);
  }
});

test("the film, its captions and the ticket desk are built with one board address", async t => {
  const output = await mkdtemp(join(tmpdir(), "portsmouth-archive-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await buildArchive(output, { BOARD_HOST: "board.portsea.example", BOARD_PORT: "22", BOARD_USER: "caller",
    SMS_SENDER_NAME: "Portsea Records", SMS_NUMBER: "+447700900982" });

  const film = await readFile(join(output, referencePath("AV/98/019"), "index.html"), "utf8");
  assert.match(film, /<code>ssh caller@board\.portsea\.example<\/code>/);
  assert.match(film, /<track kind="captions"[^>]+src="\/assets\/riggers-yard\.vtt" default>/);
  assert.match(film, /<details class="sleeve" data-ticket>[^]+<form method="post" action="\/tickets">/);
  const captions = await readFile(join(output, "assets/riggers-yard.vtt"), "utf8");
  assert.match(captions, /^WEBVTT\n/);
  assert.ok(captions.includes("ssh caller@board.portsea.example"));
  const clip = await readFile(join(output, "assets/riggers-yard.mp4"));
  assert.equal(clip.toString("ascii", 4, 8), "ftyp");
  assert.deepEqual(JSON.parse(await readFile(join(output, "settings.json"), "utf8")),
    { board: { host: "board.portsea.example", port: 22, user: "caller" }, sender: "Portsea Records", number: "+447700900982" });

  const tape = await readFile(join(output, referencePath("EH/98/041"), "index.html"), "utf8");
  assert.match(tape, /<strong>HO\/78\/017<\/strong><span class="label-number">07700 900982<\/span>/);
  const register = await readFile(join(output, referencePath("RO/98/012"), "index.html"), "utf8");
  assert.match(register, /One video cassette for the Rigger’s Yard file/);
  assert.doesNotMatch(tape + register, /AV\/98\/019|\{\{|<form/);

  await buildArchive(output, {});
  const published = await readFile(join(output, referencePath("EH/98/041"), "index.html"), "utf8");
  assert.match(published, /<span class="label-number">07460 039666<\/span>/);
  await assert.rejects(buildArchive(output, { BOARD_PORT: "70000" }), /Set BOARD_PORT to a port number below 65536\./);
});

test("the local archive opens records by reference and answers a wrong address with the missing page", async t => {
  const output = await mkdtemp(join(tmpdir(), "portsmouth-archive-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await buildArchive(output, {});
  const office = new RecordOffice({ ASSETS: new PublishedPages(output) });
  const open = (path, method = "GET") => office.fetch(new Request("http://localhost:4174" + path, { method }));

  const film = await open(referencePath("AV/98/019"));
  assert.deepEqual([film.status, film.headers.get("Content-Type")], [200, "text/html; charset=utf-8"]);
  assert.match(await film.text(), /Video cassette, Rigger’s Yard/);
  const lookup = await open(referencePath("AV/98/019"), "HEAD");
  assert.deepEqual([lookup.status, await lookup.text()], [200, ""]);
  assert.equal((await open("/records/AV-98-019")).headers.get("Location"), "http://localhost:4174/records/AV-98-019/");
  for (const path of ["/records/AV-98-018/", "/..%2F..%2Fpackage.json", "/archive-worker/index.js"]) {
    const missing = await open(path);
    assert.equal(missing.status, 404, path);
    assert.match(await missing.text(), /Page not found/);
  }
});
