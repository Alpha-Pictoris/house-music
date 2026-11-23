import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileAsync } from "sass";
import { testStripURL } from "./archive-return.mjs";
import { catalogue, holdings, renderHoldingPage, renderHoldingRow } from "./holdings.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = join(root, "archive");
const game = join(root, "web");
const playbackFiles = [
  "audio", "music", "library/house-format.js",
  "building/catalogue.js", "building/fittings.js", "building/floor-plan.js",
  "building/furniture-spots.js", "building/room-shape.js",
];

async function copyPages(source, output, layout) {
  await mkdir(output, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(output, entry.name);
    if (from === join(archive, "_layout")) continue;
    if (entry.isDirectory()) await copyPages(from, to, layout);
    else if (entry.name.endsWith(".html")) {
      await writeFile(to, layout(await readFile(from, "utf8")));
    } else await cp(from, to);
  }
}

export async function buildArchive(output) {
  const [header, footer] = await Promise.all(["header", "footer"].map(name =>
    readFile(join(archive, "_layout", name + ".html"), "utf8")));
  const rows = catalogue.map(renderHoldingRow).join("\n");
  const stripURL = testStripURL().replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const layout = page => page.replaceAll("<!-- archive-header -->", () => header)
    .replaceAll("<!-- archive-footer -->", () => footer)
    .replace("<!-- catalogue-holdings -->", () => rows)
    .replace("{{catalogue-total}}", () => catalogue.filter(record => !record.referenceOnly).length)
    .replaceAll("{{test-strip-url}}", () => stripURL);
  await copyPages(archive, output, layout);
  for (const record of holdings) {
    const directory = join(output, "records", record.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "index.html"), layout(renderHoldingPage(record)));
  }
  const theme = await compileAsync(join(root, "scripts/archive-theme.scss"), {
    loadPaths: [join(root, "node_modules/govuk-frontend/dist")],
    style: "compressed",
  });
  await writeFile(join(output, "govuk.css"), theme.css);
  const credits = "docs/puzzles/archive-credits.md";
  await cp(join(root, credits), join(output, credits));
  for (const file of playbackFiles) {
    const target = join(output, "house", file);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(game, file), target, { recursive: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = join(root, "dist-archive");
  const stage = await mkdtemp(join(root, ".dist-archive-"));
  try {
    await buildArchive(stage);
    await rm(output, { recursive: true, force: true });
    await rename(stage, output);
    console.log("Built the archive in " + output);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
