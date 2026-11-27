import { videoReference } from "./office-settings.js";

export function textMessage(sender) {
  return `${sender}: Rigger's Yard video. Catalogue reference ${videoReference}.`;
}

// Twilio answers these words itself, so the archive stays quiet.
const carrierWords = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "START", "YES", "UNSTOP", "HELP", "INFO"]);
const escaped = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const twiml = message => '<?xml version="1.0" encoding="UTF-8"?><Response>'
  + (message ? `<Message>${escaped(message)}</Message>` : "") + "</Response>";

// Answers a text sent to the number on the cassette's blue label.
export class ReferenceTexts {
  #senderName;
  #ledger;
  #digest;

  constructor({ senderName, ledger, digest }) {
    this.#senderName = senderName;
    this.#ledger = ledger;
    this.#digest = digest;
  }

  async answer({ from, body }) {
    if (!from || carrierWords.has(body.trim().toUpperCase())) return twiml();
    const { outcome } = await this.#ledger.answer({ number: await this.#digest(from) });
    if (outcome !== "answer") return twiml();
    console.log("text answered");
    return twiml(textMessage(this.#senderName));
  }
}
