import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildArchive } from "../../scripts/build-archive.mjs";
import { referencePath } from "../../archive/file-references.js";

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
  assert.doesNotMatch(catalogue, /Rigger’s Yard|EH\/98\/041|BS\/82\/016|RO\/98\/012|HO\/78\/017/);
  const shortcuts = { "EH/98/041": "cases/041", "HO/78/017": "cases/017", "BS/82/016": "records/landing", "RO/98/012": "records/deposits" };
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
