import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../../scripts/build.mjs";
import { arrangements } from "../../web/music/arrangements.js";

test("the published records, player and recordings arrive in one edition", async t => {
  const output = await mkdtemp(join(tmpdir(), "house-music-release-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const edition = await buildSite(output);
  const page = await readFile(join(output, "index.html"), "utf8");
  const records = page.match(/id="records"[^>]*>([\s\S]+?)<\/div>/)[1];
  assert.deepEqual([...records.matchAll(/data-mode="([^"]+)"/g)].map(match => match[1]), Object.keys(arrangements));
  assert.ok(page.includes('src="./' + edition + '/main.js"'));
  assert.ok((await readFile(join(output, edition, "main.js"), "utf8")).includes("./scene/house-scene.js"));
  assert.equal((await readFile(join(output, edition, "audio", "horns.wav"))).toString("ascii", 0, 4), "RIFF");
  assert.equal(await buildSite(output), edition);
});

test("game pages and artwork resolve under the repository path", async t => {
  const output = await mkdtemp(join(tmpdir(), "house-music-pages-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const edition = await buildSite(output);
  const site = new URL("https://example.org/house-music/");
  for (const file of ["index.html", "credits.html", edition + "/studio.css"]) {
    const contents = await readFile(join(output, file), "utf8");
    for (const [, link] of contents.matchAll(/(?:src="|href="|url\(")([^"#]+)"/g)) {
      const url = new URL(link, new URL(file, site));
      if (url.origin !== site.origin) continue;
      assert.ok(url.pathname.startsWith(site.pathname), link);
      await access(join(output, url.pathname.slice(site.pathname.length)));
    }
  }
});

test("the monitor's record office address follows the build setting", async t => {
  const output = await mkdtemp(join(tmpdir(), "house-music-office-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const address = page => page.match(/name="record-office" content="([^"]*)"/)[1];
  await buildSite(output);
  assert.equal(address(await readFile(join(output, "index.html"), "utf8")), "https://archive.portsmouth.technology/");

  process.env.ARCHIVE_URL = "http://office.test:4174";
  t.after(() => { delete process.env.ARCHIVE_URL; });
  await buildSite(output);
  assert.equal(address(await readFile(join(output, "index.html"), "utf8")), "http://office.test:4174/");
  process.env.ARCHIVE_URL = "office";
  await assert.rejects(buildSite(output), /Set ARCHIVE_URL/);
});
