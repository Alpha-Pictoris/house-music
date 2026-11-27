// Twilio signs each text it passes on with the account's auth token: an HMAC-SHA1 of the
// address followed by every form field in name order. Only a signed text gets the reference.
export class TwilioSignature {
  #key;

  constructor(token) {
    this.#key = crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["verify"]);
  }

  static from(env) {
    if (env.TWILIO_AUTH_TOKEN) return new TwilioSignature(env.TWILIO_AUTH_TOKEN);
  }

  async genuine(url, fields, signature) {
    let claimed;
    try { claimed = Uint8Array.from(atob(signature ?? ""), char => char.charCodeAt(0)); } catch { return false; }
    const signed = url + [...fields].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => name + value).join("");
    return crypto.subtle.verify("HMAC", await this.#key, claimed, new TextEncoder().encode(signed));
  }
}
