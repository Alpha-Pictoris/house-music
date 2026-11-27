import { publishedSettings } from "./office-settings.js";
import { TicketDesk, ticketHolder } from "./reader-ticket.js";
import { ReferenceTexts } from "./reference-texts.js";
import { openLedger } from "./request-ledger.js";
import { TwilioSender } from "./twilio-sender.js";

const json = (status, body, headers) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const refused = allow => json(405, { status: "refused", message: "Use the form on the record page." }, { Allow: allow });

function keyedDigest(secret) {
  const encoder = new TextEncoder();
  const key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return async value => {
    const digest = await crypto.subtle.sign("HMAC", await key, encoder.encode(value));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  };
}

// Answers the two forms and leaves every other address to the published pages.
export class RecordOffice {
  #env;
  #sender;
  #now;

  constructor(env, { fetch, now = Date.now, sender = TwilioSender.from(env, fetch) } = {}) {
    this.#env = env;
    this.#sender = sender;
    this.#now = now;
  }

  async fetch(request) {
    const { pathname, origin } = new URL(request.url);
    const answer = { "/texts": () => this.#text(request), "/tickets": () => this.#ticket(request) }[pathname];
    if (!answer) return this.#env.ASSETS.fetch(request);
    if (request.method === "POST" && request.headers.get("Origin") !== origin) {
      return json(403, { status: "refused", message: "Use the form on the record page." });
    }
    try {
      return await answer();
    } catch (error) {
      console.error(error.message);
      return json(503, { status: "unavailable", message: "This service is unavailable. Try again later." });
    }
  }

  async #form(request) {
    const fields = await request.formData().catch(() => new FormData());
    return name => {
      const value = fields.get(name);
      return typeof value === "string" ? value : "";
    };
  }

  async #text(request) {
    if (request.method !== "POST") return refused("POST");
    const { NUMBER_HASH_KEY: secret } = this.#env;
    if (this.#sender && !secret) console.error("Set NUMBER_HASH_KEY to switch texting on.");
    const { sender: senderName } = await publishedSettings(this.#env.ASSETS);
    const texts = new ReferenceTexts({
      sender: secret && this.#sender, senderName, now: this.#now,
      ledger: openLedger(this.#env.LEDGER), digest: secret && keyedDigest(secret),
    });
    const field = await this.#form(request);
    const { status, body } = await texts.request({ mobile: field("mobile"), consent: field("consent") }, this.#visitor(request));
    return json(status, body);
  }

  async #ticket(request) {
    if (!["GET", "HEAD", "POST"].includes(request.method)) return refused("GET, POST");
    const { BOARD_CA_KEY: authorityKey, NUMBER_HASH_KEY: secret = authorityKey } = this.#env;
    if (request.method !== "POST") return json(200, { available: Boolean(authorityKey) });
    if (!authorityKey) return json(503, { status: "unavailable", message: "The ticket is not available at present." });
    const { board } = await publishedSettings(this.#env.ASSETS);
    const desk = new TicketDesk({ authorityKey, user: board.user, now: this.#now });
    const visitor = await keyedDigest(secret)(this.#visitor(request));
    const admission = await openLedger(this.#env.LEDGER).admit({ visitor });
    if (admission.outcome !== "admitted") {
      return json(429, { status: "wait", message: "Too many tickets taken from this connection. Try again in an hour." });
    }
    const field = await this.#form(request);
    const ticket = await desk.issue(ticketHolder({ recording: field("recording"), title: field("title") }));
    return new Response(ticket, { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="readers-ticket.zip"',
      "Cache-Control": "no-store",
    } });
  }

  #visitor(request) {
    return request.headers.get("CF-Connecting-IP") ?? "unknown";
  }
}
