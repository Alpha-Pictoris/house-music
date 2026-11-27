const minute = 60e3, hour = 60 * minute, day = 24 * hour;

export const limits = {
  cooldown: 2 * minute,
  visitWindow: hour,
  ticketsPerVisitor: 10,
  // Texts answered in one day, counted from midnight UTC.
  ceiling: 400,
};

// One Durable Object counts every text answered and ticket taken. Each action reads and
// writes without waiting, so two texts from one number cannot both be answered.
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
      answer: () => this.#answer(details),
      admit: () => this.#admit(details),
    };
    return Response.json(actions[action]());
  }

  alarm() {
    const now = this.#now();
    for (const [key, times] of this.#records.list({ prefix: "visitor:" })) {
      if (times.every(at => at <= now - limits.visitWindow)) this.#records.delete(key);
    }
    for (const [key, at] of this.#records.list({ prefix: "number:" })) {
      if (at <= now - limits.cooldown) this.#records.delete(key);
    }
  }

  #answer({ number }) {
    const now = this.#now(), key = "number:" + number;
    if (now < (this.#records.get(key) ?? -Infinity) + limits.cooldown) return { outcome: "quiet" };
    const today = Math.floor(now / day), tally = this.#records.get("texts");
    const answered = tally?.day === today ? tally.count : 0;
    if (answered >= this.#ceiling) return { outcome: "quiet" };
    this.#records.put(key, now);
    this.#records.put("texts", { day: today, count: answered + 1 });
    this.#storage.setAlarm(now + 2 * limits.visitWindow);
    return { outcome: "answer" };
  }

  #admit({ visitor }) {
    const now = this.#now(), key = "visitor:ticket:" + visitor;
    const times = (this.#records.get(key) ?? []).filter(at => at > now - limits.visitWindow);
    if (times.length >= limits.ticketsPerVisitor) return { outcome: "too-many", retryAt: times[0] + limits.visitWindow };
    this.#records.put(key, [...times, now]);
    this.#storage.setAlarm(now + 2 * limits.visitWindow);
    return { outcome: "admitted" };
  }
}

export function openLedger(namespace) {
  const ledger = namespace.get(namespace.idFromName("riggers-yard"));
  const ask = async details => {
    const response = await ledger.fetch("https://ledger.local/", { method: "POST", body: JSON.stringify(details) });
    return response.json();
  };
  return {
    answer: details => ask({ action: "answer", ...details }),
    admit: details => ask({ action: "admit", ...details }),
  };
}
