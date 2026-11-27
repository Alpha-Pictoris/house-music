import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { RecordOffice } from "../archive-worker/record-office.js";
import { generateKey, publicKeyLine, writePrivateKey } from "../archive-worker/ssh-keys.js";
import { TwilioSender } from "../archive-worker/twilio-sender.js";
import { memoryLedger, PublishedPages } from "./archive-stand-ins.mjs";

const port = 4174;
const pages = fileURLToPath(new URL("../dist-archive", import.meta.url));
const boardAuthority = fileURLToPath(new URL("../bbs/user_ca", import.meta.url));

async function authorityKey() {
  const saved = process.env.BOARD_CA_KEY ?? await readFile(boardAuthority, "utf8").catch(() => null);
  if (saved) return saved;
  const key = await generateKey();
  console.log("Reader’s tickets are signed by a throwaway authority for this run. To try them on a local board,\n"
    + "save this line as bbs/user_ca.pub and restart the board:\n\n" + publicKeyLine(key, "throwaway archive authority"));
  return writePrivateKey(key, "throwaway archive authority");
}

let texts = 0;
const terminal = {
  async send(to, body) {
    console.log(`Text to a number ending ${to.slice(-3)}:\n  ${body}`);
    return { outcome: "accepted", sid: "local-" + ++texts };
  },
};

const env = {
  ...process.env,
  ASSETS: new PublishedPages(pages),
  BOARD_CA_KEY: await authorityKey(),
  NUMBER_HASH_KEY: process.env.NUMBER_HASH_KEY ?? randomBytes(32).toString("hex"),
};
env.LEDGER = memoryLedger(env);
const office = new RecordOffice(env, { sender: TwilioSender.from(env) ?? terminal });

createServer(async (incoming, outgoing) => {
  const headers = new Headers(Object.entries(incoming.headers).filter(([, value]) => typeof value === "string"));
  headers.set("CF-Connecting-IP", incoming.socket.remoteAddress);
  const hasBody = !["GET", "HEAD"].includes(incoming.method);
  const response = await office.fetch(new Request(`http://${incoming.headers.host}${incoming.url}`, {
    method: incoming.method, headers, body: hasBody ? Readable.toWeb(incoming) : undefined, duplex: "half",
  }));
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "0.0.0.0", () => {
  console.log(`The archive is open on http://localhost:${port}/. Requested texts print here.`);
});
