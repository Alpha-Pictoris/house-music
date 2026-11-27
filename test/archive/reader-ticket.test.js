import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { officeSettings } from "../../archive-worker/office-settings.js";
import { RecordOffice } from "../../archive-worker/record-office.js";
import { limits } from "../../archive-worker/request-ledger.js";
import { generateKey, writePrivateKey } from "../../archive-worker/ssh-keys.js";
import { memoryLedger } from "../../scripts/archive-stand-ins.mjs";

const origin = "https://archive.example";
const issued = Date.UTC(2026, 10, 27, 12);

async function openOffice(authority) {
  const env = { ASSETS: { fetch: async () => Response.json(officeSettings({ BOARD_USER: "caller" })) } };
  if (authority) env.BOARD_CA_KEY = writePrivateKey(authority, "board authority");
  env.LEDGER = memoryLedger(env, () => issued);
  const desk = new RecordOffice(env, { now: () => issued });
  return (method, fields) => desk.fetch(new Request(origin + "/tickets", {
    method, headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.7" }, body: fields && new URLSearchParams(fields),
  }));
}

function unzip(bytes) {
  const view = new DataView(bytes.buffer), files = {};
  let entry = view.getUint32(bytes.length - 6, true);
  for (let count = view.getUint16(bytes.length - 12, true); count > 0; count--) {
    const nameLength = view.getUint16(entry + 28, true), size = view.getUint32(entry + 24, true);
    const start = view.getUint32(entry + 42, true) + 30 + nameLength;
    const name = new TextDecoder().decode(bytes.subarray(entry + 46, entry + 46 + nameLength));
    files[name] = { mode: view.getUint32(entry + 38, true) >>> 16 & 0o777, text: new TextDecoder().decode(bytes.subarray(start, start + size)) };
    entry += 46 + nameLength;
  }
  return files;
}

// Reads the certificate fields in the order OpenSSH writes them.
function readCertificate(line) {
  const bytes = Uint8Array.from(atob(line.split(" ")[1]), character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const string = () => {
    const length = view.getUint32(offset);
    offset += 4 + length;
    return bytes.subarray(offset - length, offset);
  };
  const text = () => new TextDecoder().decode(string());
  const number = size => {
    offset += size;
    return size === 4 ? view.getUint32(offset - 4) : Number(view.getBigUint64(offset - 8));
  };
  const certificate = { type: text(), nonce: string(), publicKey: string(), serial: number(8), kind: number(4), keyId: text(),
    principals: string(), validAfter: number(8), validBefore: number(8), criticalOptions: string(), extensions: string(),
    reserved: string(), authority: string() };
  return { ...certificate, signed: bytes.subarray(0, offset), signature: string().subarray(-64) };
}

test("the sleeve holds a ticket the board will admit", async t => {
  const authority = await generateKey();
  const ask = await openOffice(authority);
  assert.deepEqual(await (await ask("GET")).json(), { available: true });
  const response = await ask("POST", { recording: "041a / 1A2B-3C4D", title: "The blue\u0007 room\n" });
  assert.equal(response.headers.get("Content-Type"), "application/zip");
  assert.match(response.headers.get("Content-Disposition"), /attachment; filename="readers-ticket\.zip"/);
  const files = unzip(new Uint8Array(await response.arrayBuffer()));
  assert.deepEqual(Object.entries(files).map(([name, file]) => [name, file.mode]),
    [["readers-ticket", 0o600], ["readers-ticket-cert.pub", 0o644], ["readers-ticket.txt", 0o644]]);
  assert.match(files["readers-ticket.txt"].text, /Recording: 041a \/ 1A2B-3C4D · The blue room\r\n/);
  assert.match(files["readers-ticket.txt"].text, /ssh -i readers-ticket /);

  const certificate = readCertificate(files["readers-ticket-cert.pub"].text);
  const text = new TextEncoder();
  const packed = (...values) => Buffer.concat(values.map(value => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(Buffer.byteLength(value));
    return Buffer.concat([length, Buffer.from(value)]);
  }));
  assert.equal(certificate.type, "ssh-ed25519-cert-v01@openssh.com");
  assert.equal(certificate.kind, 1);
  assert.deepEqual(Buffer.from(certificate.principals), packed("caller"));
  assert.equal(certificate.validAfter, issued / 1000 - 300);
  assert.equal(certificate.validBefore, issued / 1000 + 30 * 86400);
  assert.equal(certificate.criticalOptions.length, 0);
  assert.deepEqual(Buffer.from(certificate.extensions),
    packed("userdata@house-music", packed(text.encode("041a / 1A2B-3C4D · The blue room"))));
  assert.deepEqual(Buffer.from(certificate.authority), packed("ssh-ed25519", authority.publicKey));
  const trusted = await crypto.subtle.importKey("raw", authority.publicKey, { name: "Ed25519" }, false, ["verify"]);
  assert.ok(await crypto.subtle.verify({ name: "Ed25519" }, trusted, certificate.signature, certificate.signed));

  let described;
  const folder = await mkdtemp(join(tmpdir(), "readers-ticket-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const [name, file] of Object.entries(files)) {
    await writeFile(join(folder, name), file.text);
    await chmod(join(folder, name), file.mode);
  }
  try {
    described = execFileSync("ssh-keygen", ["-L", "-f", join(folder, "readers-ticket-cert.pub")], { encoding: "utf8" });
  } catch (error) {
    if (error.code === "ENOENT") return t.diagnostic("ssh-keygen is not installed, so OpenSSH did not read the ticket");
    throw error;
  }
  assert.match(described, /user certificate/);
  assert.match(described, /Principals:\s+caller\s+Critical Options: \(none\)\s+Extensions:\s+userdata@house-music/);
  const fingerprint = execFileSync("ssh-keygen", ["-l", "-f", join(folder, "readers-ticket")], { encoding: "utf8" }).split(" ")[1];
  assert.ok(described.includes("Public key: ED25519-CERT " + fingerprint));
});

test("a reader without a house gets a reference copy ticket, and each connection has a limit", async () => {
  const ask = await openOffice(await generateKey());
  for (const fields of [undefined, { recording: "041a / anything", title: "Forged" }]) {
    const files = unzip(new Uint8Array(await (await ask("POST", fields)).arrayBuffer()));
    assert.match(files["readers-ticket.txt"].text, /Recording: reference copy\r\n/);
  }
  for (let taken = 2; taken < limits.ticketsPerVisitor; taken++) assert.equal((await ask("POST")).status, 200);
  const refused = await ask("POST");
  assert.equal(refused.status, 429);
  assert.match((await refused.json()).message, /Too many tickets/);
});

test("without the board’s authority key the ticket is unavailable", async t => {
  t.mock.method(console, "error", () => {});
  const ask = await openOffice();
  assert.deepEqual(await (await ask("GET")).json(), { available: false });
  const refused = await ask("POST");
  assert.deepEqual([refused.status, (await refused.json()).message], [503, "The ticket is not available at present."]);

  const env = { BOARD_CA_KEY: "not a key", ASSETS: { fetch: async () => Response.json(officeSettings({})) } };
  env.LEDGER = memoryLedger(env);
  const broken = await new RecordOffice(env).fetch(new Request(origin + "/tickets", { method: "POST", headers: { Origin: origin } }));
  assert.equal(broken.status, 503);
});
