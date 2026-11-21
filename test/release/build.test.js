import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../../scripts/build.mjs";
import { arrangements } from "../../web/music/arrangements.js";

test("the published menu, player and recordings arrive in one edition", async t => {
  const output = await mkdtemp(join(tmpdir(), "house-music-release-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const edition = await buildSite(output);
  const page = await readFile(join(output, "index.html"), "utf8");
  const menu = page.match(/<select id="mode">([\s\S]+?)<\/select>/)[1];
  assert.deepEqual([...menu.matchAll(/value="([^"]+)"/g)].map(match => match[1]), Object.keys(arrangements));
  assert.ok(page.includes('src="./' + edition + '/main.js"'));
  assert.ok((await readFile(join(output, edition, "main.js"), "utf8")).includes("./scene/house-scene.js"));
  assert.equal((await readFile(join(output, edition, "audio", "horns.wav"))).toString("ascii", 0, 4), "RIFF");
  assert.equal(await buildSite(output), edition);
});
