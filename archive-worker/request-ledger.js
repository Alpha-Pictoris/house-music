const minute = 60e3, hour = 60 * minute;

export const limits = {
  cooldown: 15 * minute,
  pendingHold: 2 * minute,
  optOutHold: 24 * hour,
  visitWindow: hour,
  textsPerVisitor: 5,
  ticketsPerVisitor: 10,
  ceiling: 400,
};

// One Durable Object holds every reservation. Each action reads and writes without
// waiting, so two requests for the same number cannot both reserve it.
export class RequestLedger {
  #storage;
  #records;
  #ceiling;
  #now;

  constructor(state, env = {}, now = Date.now) {
    this.#storage = state.storage;
    this.#records = state.storage.kv;
    this.#ceiling = Number(env.SMS_SEND_CEILING) || limits.ceiling;
    this.#now = now;
  }

  async fetch(request) {
    const { action, ...details } = await request.json();
    const actions = {
      reserve: () => this.#reserve(details),
      settle: () => this.#settle(details),
      admit: () => this.#admit(details),
    };
    return Response.json(actions[action]());
  }

  alarm() {
    const stale = this.#now() - limits.visitWindow;
    for (const [key, times] of this.#records.list({ prefix: "visitor:" })) {
      if (times.every(at => at <= stale)) this.#records.delete(key);
    }
  }

  #visit(purpose, visitor, allowed) {
    const now = this.#now(), key = `visitor:${purpose}:${visitor}`;
    const times = (this.#records.get(key) ?? []).filter(at => at > now - limits.visitWindow);
    if (times.length >= allowed) return times[0] + limits.visitWindow;
    this.#records.put(key, [...times, now]);
    this.#storage.setAlarm(now + 2 * limits.visitWindow);
  }

  #reserve({ number, visitor, consent }) {
    const now = this.#now();
    const retryAt = this.#visit("text", visitor, limits.textsPerVisitor);
    if (retryAt) return { outcome: "too-many", retryAt };
    const optOut = this.#records.get("opt-out:" + number);
    if (optOut && now < optOut.at + limits.optOutHold) return { outcome: "opted-out" };
    const record = this.#records.get("number:" + number) ?? { requests: [], until: 0 };
    if (now < record.until) return { outcome: "duplicate" };
    const reserved = this.#records.get("texts") ?? 0;
    if (reserved >= this.#ceiling) return { outcome: "ceiling" };
    record.requests.push({ at: now, consent });
    record.until = now + limits.pendingHold;
    this.#records.put("number:" + number, record);
    this.#records.put("texts", reserved + 1);
    return { outcome: "reserved" };
  }

  #settle({ number, outcome, sid }) {
    const record = this.#records.get("number:" + number);
    const request = record?.requests.at(-1);
    if (!request || request.sid) return {};
    if (outcome === "accepted") {
      request.sid = sid;
      record.until = request.at + limits.cooldown;
    } else {
      record.requests.pop();
      record.until = 0;
      this.#records.put("texts", this.#records.get("texts") - 1);
      if (outcome === "opted-out") this.#records.put("opt-out:" + number, { at: this.#now() });
    }
    this.#records.put("number:" + number, record);
    return {};
  }

  #admit({ visitor }) {
    const retryAt = this.#visit("ticket", visitor, limits.ticketsPerVisitor);
    return retryAt ? { outcome: "too-many", retryAt } : { outcome: "admitted" };
  }
}

export function openLedger(namespace) {
  const ledger = namespace.get(namespace.idFromName("riggers-yard"));
  const ask = async details => {
    const response = await ledger.fetch("https://ledger.local/", { method: "POST", body: JSON.stringify(details) });
    return response.json();
  };
  return {
    reserve: details => ask({ action: "reserve", ...details }),
    settle: details => ask({ action: "settle", ...details }),
    admit: details => ask({ action: "admit", ...details }),
  };
}
