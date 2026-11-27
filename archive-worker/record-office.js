import { publishedSettings } from "./office-settings.js";
import { TicketDesk, ticketHolder } from "./reader-ticket.js";
import { ReferenceTexts } from "./reference-texts.js";
import { openLedger } from "./request-ledger.js";
import { TwilioSignature } from "./twilio-signature.js";

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

// Answers texts passed on by Twilio and the ticket form, and leaves every other address to the published pages.
export class RecordOffice {
  #env;
  #twilio;
  #now;

  constructor(env, { now = Date.now, twilio = TwilioSignature.from(env) } = {}) {
    this.#env = env;
    this.#twilio = twilio;
    this.#now = now;
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    const answer = { "/texts": () => this.#text(request), "/tickets": () => this.#ticket(request) }[pathname];
    if (!answer) return this.#env.ASSETS.fetch(request);
    try {
      return await answer();
    } catch (error) {
      console.error(error.message);
      return json(503, { status: "unavailable", message: "This service is unavailable. Try again later." });
    }
  }

  async #text(request) {
    if (request.method !== "POST") return refused("POST");
    const { TWILIO_AUTH_TOKEN: token, NUMBER_HASH_KEY: secret = token } = this.#env;
    if (!this.#twilio || !secret) return json(503, { status: "unavailable", message: "Texts are not switched on." });
    const fields = await request.formData().catch(() => new FormData());
    const words = [...fields].filter(([, value]) => typeof value === "string");
    if (!await this.#twilio.genuine(request.url, words, request.headers.get("X-Twilio-Signature"))) {
      return json(403, { status: "refused", message: "Only Twilio may pass on a text." });
    }
    const { sender: senderName } = await publishedSettings(this.#env.ASSETS);
    const texts = new ReferenceTexts({ senderName, ledger: openLedger(this.#env.LEDGER), digest: keyedDigest(secret) });
    const field = name => words.find(([key]) => key === name)?.[1] ?? "";
    return new Response(await texts.answer({ from: field("From"), body: field("Body") }), {
      headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  async #ticket(request) {
    if (!["GET", "HEAD", "POST"].includes(request.method)) return refused("GET, POST");
    const { BOARD_CA_KEY: authorityKey, NUMBER_HASH_KEY: secret = authorityKey } = this.#env;
    if (request.method !== "POST") return json(200, { available: Boolean(authorityKey) });
    if (request.headers.get("Origin") !== new URL(request.url).origin) {
      return json(403, { status: "refused", message: "Use the form on the record page." });
    }
    if (!authorityKey) return json(503, { status: "unavailable", message: "The ticket is not available at present." });
    const { board } = await publishedSettings(this.#env.ASSETS);
    const desk = new TicketDesk({ authorityKey, user: board.user, now: this.#now });
    const visitor = await keyedDigest(secret)(this.#visitor(request));
    const admission = await openLedger(this.#env.LEDGER).admit({ visitor });
    if (admission.outcome !== "admitted") {
      return json(429, { status: "wait", message: "Too many tickets taken from this connection. Try again in an hour." });
    }
    const fields = await request.formData().catch(() => new FormData());
    const field = name => typeof fields.get(name) === "string" ? fields.get(name) : "";
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
