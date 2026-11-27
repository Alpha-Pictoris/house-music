import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { RequestLedger } from "../archive-worker/request-ledger.js";

const types = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".mp4": "video/mp4", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".vtt": "text/vtt; charset=utf-8", ".wav": "audio/wav", ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// Serves a built archive the way the Worker’s ASSETS binding does: folders open their
// index page and a missing address gets the 404 page.
export class PublishedPages {
  #directory;

  constructor(directory) {
    this.#directory = directory;
  }

  async fetch(request) {
    const { method, url: address } = new Request(request);
    if (!["GET", "HEAD"].includes(method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(address);
    let path = join(this.#directory, normalize(decodeURIComponent(url.pathname)));
    if (!(path + sep).startsWith(this.#directory + sep)) return this.#page(join(this.#directory, "404.html"), 404, method);
    const found = await stat(path).catch(() => null);
    if (found?.isDirectory()) {
      if (!url.pathname.endsWith("/")) return Response.redirect(new URL(url.pathname + "/" + url.search, url), 307);
      path = join(path, "index.html");
    }
    return await this.#page(path, 200, method) ?? this.#page(join(this.#directory, "404.html"), 404, method);
  }

  async #page(path, status, method) {
    const bytes = await readFile(path).catch(() => null);
    if (!bytes) return;
    return new Response(method === "HEAD" ? null : bytes, { status, headers: {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Content-Length": String(bytes.length),
    } });
  }
}

// A Durable Object namespace with one ledger kept in memory.
export function memoryLedger(env = {}, now = Date.now) {
  const records = new Map();
  const kv = {
    get: key => structuredClone(records.get(key)),
    put: (key, value) => void records.set(key, structuredClone(value)),
    delete: key => records.delete(key),
    list: ({ prefix = "" } = {}) => [...records].filter(([key]) => key.startsWith(prefix)).map(entry => structuredClone(entry)),
  };
  const storage = { kv, alarm: null, setAlarm(time) { this.alarm = time; } };
  const ledger = new RequestLedger({ storage }, env, now);
  return {
    ledger, storage,
    idFromName: name => name,
    get: () => ({ fetch: (url, init) => ledger.fetch(new Request(url, init)) }),
  };
}
