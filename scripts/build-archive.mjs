import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileAsync } from "sass";
import { referencePath } from "../archive/file-references.js";
import { boardAddress, boardCommand, officeSettings, settingsPath, videoReference, writtenNumber } from "../archive-worker/office-settings.js";
import { testStripURL } from "./archive-return.mjs";
import { holdings, renderHoldingPage, renderHoldingRow } from "./holdings.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = join(root, "archive");
const game = join(root, "web");
const fileReferences = new Map([
  ["EH/98/041", "/cases/041/"],
  ["BS/82/016", "/records/landing/"],
  ["RO/98/012", "/records/deposits/"],
  ["HO/78/017", "/cases/017/"],
  [videoReference, "/records/videotape/"],
]);
const playbackFiles = [
  "audio", "music", "library/house-format.js",
  "building/b-side.js", "building/catalogue.js", "building/fittings.js", "building/floor-plan.js",
  "building/furniture-spots.js", "building/room-shape.js",
];

async function copyPages(source, output, layout) {
  await mkdir(output, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(output, entry.name);
    if (from === join(archive, "_layout")) continue;
    if (entry.isDirectory()) await copyPages(from, to, layout);
    else if (/\.(?:html|vtt)$/.test(entry.name)) {
      await writeFile(to, layout(await readFile(from, "utf8")));
    } else await cp(from, to);
  }
}

export async function buildArchive(output, env = process.env) {
  const [header, footer, redirect] = await Promise.all(["header", "footer", "catalogue-redirect"].map(name =>
    readFile(join(archive, "_layout", name + ".html"), "utf8")));
  const rows = holdings.map(renderHoldingRow).join("\n");
  const entries = (await readdir(archive)).filter(name => /\.(?:js|css)$/.test(name));
  const versions = new Map(await Promise.all(entries.map(async name => {
    const content = await readFile(join(archive, name));
    const version = createHash("sha256").update(content).digest("hex").slice(0, 12);
    return [name, `/${name}?v=${version}`];
  })));
  const stripURL = testStripURL().replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const settings = officeSettings(env);
  const layout = page => page.replaceAll("<!-- archive-header -->", () => header)
    .replaceAll("<!-- archive-footer -->", () => footer)
    .replace("<!-- catalogue-holdings -->", () => rows)
    .replace("{{catalogue-total}}", () => holdings.length)
    .replaceAll("{{test-strip-url}}", () => stripURL)
    .replaceAll("{{board-command}}", () => boardCommand(settings.board))
    .replaceAll("{{board-address}}", () => boardAddress(settings.board))
    .replace("{{label-number}}", () => writtenNumber(settings.number))
    .replace(/"(\/([^/"]+\.(?:js|css)))"/g, (_attribute, path, name) => `"${versions.get(name) ?? path}"`);
  await copyPages(archive, output, layout);
  await writeFile(join(output, settingsPath), JSON.stringify(settings));
  for (const [reference, source] of fileReferences) {
    const directory = join(output, referencePath(reference));
    await mkdir(directory, { recursive: true });
    const original = join(output, source, "index.html");
    await rename(original, join(directory, "index.html"));
    await writeFile(original, redirect);
  }
  for (const section of ["cases", "records"]) {
    await writeFile(join(output, section, "index.html"), redirect);
  }
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

export async function publishArchive(env = process.env) {
  const output = join(root, "dist-archive");
  const stage = await mkdtemp(join(root, ".dist-archive-"));
  try {
    await buildArchive(stage, env);
    await rm(output, { recursive: true, force: true });
    await rename(stage, output);
    console.log("Built the archive in " + output);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await publishArchive();
