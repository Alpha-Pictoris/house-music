import { generateKey, readPrivateKey, signCertificate, writePrivateKey } from "./ssh-keys.js";
import { zip } from "./zip.js";

const clockSkew = 5 * 60e3;
const validity = 30 * 24 * 3600e3;
const name = "readers-ticket";
const recordingNumber = /^041a \/ [0-9A-F]{4}-[0-9A-F]{4}$/;

const plain = (text, length) => [...String(text ?? "").replace(/[\p{Cc}\s]+/gu, " ").trim()].slice(0, length).join("");
const day = time => new Date(time).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function ticketHolder({ recording, title }) {
  if (!recordingNumber.test(recording)) return "reference copy";
  return [recording, plain(title, 100)].filter(Boolean).join(" · ");
}

export class TicketDesk {
  #authority;
  #user;
  #now;

  constructor({ authorityKey, user, now = Date.now }) {
    this.#authority = readPrivateKey(authorityKey);
    this.#user = user;
    this.#now = now;
  }

  async issue(holder) {
    const now = this.#now(), expires = now + validity;
    const key = await generateKey();
    const certificate = await signCertificate({
      authority: this.#authority, key, user: this.#user, userdata: holder,
      validAfter: Math.floor((now - clockSkew) / 1000), validBefore: Math.floor(expires / 1000),
    });
    const note = [
      "Portsmouth City Record Office",
      "Reader's ticket",
      "",
      `Issued ${day(now)}. Valid until ${day(expires)}.`,
      "Recording: " + holder,
      "",
    ].join("\r\n");
    return zip([
      { name, text: writePrivateKey(key, "reader's ticket"), mode: 0o600 },
      { name: name + "-cert.pub", text: certificate, mode: 0o644 },
      { name: name + ".txt", text: note, mode: 0o644 },
    ], now);
  }
}
