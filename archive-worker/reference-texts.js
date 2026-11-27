import { videoReference } from "./office-settings.js";
import { limits } from "./request-ledger.js";

// Names the wording beside the “Text me the reference” button. Change it when that wording changes.
export const consentVersion = "2026-11-27";

export function textMessage(sender) {
  return `${sender}: Rigger's Yard video. Catalogue reference ${videoReference}. Reply STOP to unsubscribe.`;
}

export function ukMobile(entry) {
  const digits = String(entry ?? "").replace(/[\s().-]/g, "");
  const parts = /^(?:(?:\+|00)?440?|0)(7[1-9]\d{8})$/.exec(digits);
  if (parts) return "+44" + parts[1];
}

const minutes = time => {
  const count = Math.max(1, Math.ceil(time / 60e3));
  return count === 1 ? "1 minute" : count + " minutes";
};
const reply = (status, body) => ({ status, body });
const requested = preview => reply(200, {
  status: "requested",
  message: `If the text has not arrived after ${minutes(limits.cooldown)}, check the number and ask again.`,
  ...preview && { preview },
});

export class ReferenceTexts {
  #sender;
  #senderName;
  #ledger;
  #digest;
  #now;

  // Without a sender the reply carries the text, so the archive can be read before texting is switched on.
  constructor({ sender, senderName, ledger, digest, now = Date.now }) {
    this.#sender = sender;
    this.#senderName = senderName;
    this.#ledger = ledger;
    this.#digest = digest;
    this.#now = now;
  }

  async request({ mobile, consent }, visitor) {
    const to = ukMobile(mobile);
    if (!to) return reply(422, { status: "invalid", field: "mobile", message: "Enter a UK mobile number, like 07700 900 982" });
    if (consent !== consentVersion) return reply(409, { status: "stale", message: "Reload this page and ask again." });
    const text = textMessage(this.#senderName);
    if (!this.#sender) return requested(text);

    const number = await this.#digest(to);
    const reservation = await this.#ledger.reserve({ number, visitor: await this.#digest(visitor), consent });
    switch (reservation.outcome) {
      case "duplicate": return requested();
      case "too-many": return reply(429, { status: "wait", message: `Too many requests from this connection. Try again in ${minutes(reservation.retryAt - this.#now())}.` });
      case "opted-out": return this.#optedOut();
      case "ceiling": return reply(503, { status: "unavailable", message: "We cannot send any more texts at present. Try again later." });
    }

    const sent = await this.#sender.send(to, text);
    if (sent.outcome === "unknown") {
      console.error("text unconfirmed");
      return reply(503, { status: "unavailable", message: `We could not confirm that the text was sent. If it has not arrived, ask again in ${minutes(limits.pendingHold)}.` });
    }
    await this.#ledger.settle({ number, outcome: sent.outcome, sid: sent.sid });
    switch (sent.outcome) {
      case "accepted":
        console.log("text accepted", sent.sid);
        return requested();
      case "wrong-number": return reply(422, { status: "invalid", field: "mobile", message: "Enter a mobile number that can receive texts" });
      case "opted-out": return this.#optedOut();
    }
    console.error("text refused", sent.code);
    return reply(503, { status: "unavailable", message: "We could not send the text. Try again in a few minutes." });
  }

  #optedOut() {
    return reply(409, { status: "opted-out", message: `This number has opted out of texts from ${this.#senderName}. Reply START to our last text, then ask again tomorrow.` });
  }
}
