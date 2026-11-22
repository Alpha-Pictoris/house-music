import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { recordSleeves } from "../web/ui/record-sleeves.js";

const source = fileURLToPath(new URL("../web", import.meta.url));

async function readTree(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await readTree(path, name + "/"));
    else if (entry.isFile()) files.push({ name, bytes: await readFile(path) });
  }
  return files;
}

function page(bytes, directory) {
  return bytes.toString("utf8")
    .replaceAll(/(src|href)="\.\/([^"]+\.(?:js|css|svg))"/g, '$1="./' + directory + '/$2"')
    .replace(/(<div [^>]*id="records"[^>]*>)<\/div>/, (_, start) => start + recordSleeves() + "</div>");
}

export async function buildSite(output) {
  output = resolve(output);
  if (output === source || output.startsWith(source + sep)) throw Error("Choose a build folder outside web.");
  const files = await readTree(source);
  const digest = createHash("sha256");
  for (const { name, bytes } of files.sort((a, b) => a.name < b.name ? -1 : 1)) {
    digest.update(name).update("\0").update(createHash("sha256").update(bytes).digest());
  }
  const directory = "assets/" + digest.digest("hex").slice(0, 16);
  const assets = join(output, "assets");
  await mkdir(assets, { recursive: true });
  const stage = await mkdtemp(join(assets, ".build-"));
  try {
    for (const { name, bytes } of files.filter(file => !file.name.endsWith(".html"))) {
      const target = join(stage, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    try { await rename(stage, join(output, directory)); }
    catch (error) { if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error; }
    for (const { name, bytes } of files.filter(file => file.name.endsWith(".html"))) {
      const temporary = join(output, name + "." + stage.split(sep).at(-1));
      await writeFile(temporary, page(bytes, directory));
      await rename(temporary, join(output, name));
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  return directory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(process.argv[2] ?? "dist");
  await buildSite(output);
  console.log("Built House Music in " + output);
}
