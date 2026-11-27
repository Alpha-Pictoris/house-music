const wrongNumber = new Set([21211, 21614]);
const optedOut = 21610;

export class TwilioSender {
  #account;
  #token;
  #origin;
  #fetch;

  constructor({ account, token, from, service, fetch = globalThis.fetch }) {
    this.#account = account;
    this.#token = token;
    this.#origin = service ? { MessagingServiceSid: service } : { From: from };
    // Workers refuse a fetch called as a method of another object.
    this.#fetch = (...request) => fetch(...request);
  }

  static from(env, fetch) {
    const { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, TWILIO_MESSAGING_SERVICE_SID: service } = env;
    if (account && token && (from || service)) return new TwilioSender({ account, token, from, service, fetch });
  }

  // "unknown" means Twilio may have sent the text: the request timed out or the service failed mid-reply.
  async send(to, body) {
    let response;
    try {
      response = await this.#fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.#account}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + btoa(this.#account + ":" + this.#token) },
        body: new URLSearchParams({ To: to, Body: body, ...this.#origin }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      return { outcome: "unknown" };
    }
    if (response.status >= 500) return { outcome: "unknown" };
    const reply = await response.json().catch(() => ({}));
    if (response.ok) return { outcome: "accepted", sid: reply.sid };
    if (reply.code === optedOut) return { outcome: "opted-out" };
    if (wrongNumber.has(reply.code)) return { outcome: "wrong-number" };
    return { outcome: "refused", code: reply.code ?? response.status };
  }
}
