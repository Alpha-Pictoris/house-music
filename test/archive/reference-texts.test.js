import assert from "node:assert/strict";
import test from "node:test";
import { officeSettings } from "../../archive-worker/office-settings.js";
import { RecordOffice } from "../../archive-worker/record-office.js";
import { consentVersion, ukMobile } from "../../archive-worker/reference-texts.js";
import { limits } from "../../archive-worker/request-ledger.js";
import { memoryLedger } from "../../scripts/archive-stand-ins.mjs";

const origin = "https://archive.example";
const twilio = { TWILIO_ACCOUNT_SID: "AC0123", TWILIO_AUTH_TOKEN: "token", TWILIO_FROM: "+447700900000", NUMBER_HASH_KEY: "pepper" };
const accepted = () => Response.json({ sid: "SM1" }, { status: 201 });
const rejected = code => () => Response.json({ code, message: "Twilio said no", status: 400 }, { status: 400 });

// An archive whose texts go to a stand-in for Twilio. `answer` decides what Twilio says next.
function openOffice(t, secrets = twilio) {
  const office = { time: Date.UTC(2026, 10, 27, 12), sent: [], answer: accepted, logged: [] };
  for (const method of ["log", "error"]) t.mock.method(console, method, (...words) => office.logged.push(words.join(" ")));
  const now = () => office.time;
  const env = { ...secrets, ASSETS: { fetch: async () => Response.json(officeSettings({ SMS_SENDER_NAME: "Portsea Records" })) } };
  office.ledger = env.LEDGER = memoryLedger(env, now);
  const fetch = async (url, request) => {
    office.sent.push({ url, authorization: request.headers.Authorization, ...Object.fromEntries(request.body) });
    return office.answer();
  };
  const desk = new RecordOffice(env, { fetch, now });
  office.ask = async (mobile, { visitor = "203.0.113.7", from = origin, consent = consentVersion } = {}) => {
    const response = await desk.fetch(new Request(origin + "/texts", {
      method: "POST", headers: { Origin: from, "CF-Connecting-IP": visitor }, body: new URLSearchParams({ mobile, consent }),
    }));
    return { code: response.status, ...await response.json() };
  };
  return office;
}

test("a UK mobile number is read however the reader types it", () => {
  for (const entry of ["07700 900982", "+44 7700 900982", "0044 7700-900-982", "+44 (0)7700 900982", "447700900982"]) {
    assert.equal(ukMobile(entry), "+447700900982", entry);
  }
  for (const entry of ["", "0770090098", "077009009821", "02392 822251", "+1 202 555 0143", "07000 900982", "seven"]) {
    assert.equal(ukMobile(entry), undefined, entry);
  }
});

test("before texting is switched on the reply carries the text for the page to show", async t => {
  const office = openOffice(t, {});
  const reply = await office.ask("07700 900982");
  assert.equal(reply.status, "requested");
  assert.equal(reply.preview, "Portsea Records: Rigger's Yard video. Catalogue reference AV/98/019. Reply STOP to unsubscribe.");
  assert.deepEqual(await office.ask("023 9282 2251"),
    { code: 422, status: "invalid", field: "mobile", message: "Enter a UK mobile number, like 07700 900 982" });
  assert.equal((await office.ask("07700 900982", { consent: "2025-01-01" })).status, "stale");
  assert.equal((await office.ask("07700 900982", { from: "https://elsewhere.example" })).code, 403);
});

test("three requests for one number send one text and keep the reference out of every reply", async t => {
  const office = openOffice(t);
  const replies = await Promise.all([office.ask("07700 900982"), office.ask("+44 7700 900982")]);
  replies.push(await office.ask("07700900982"));

  assert.deepEqual(office.sent, [{
    url: "https://api.twilio.com/2010-04-01/Accounts/AC0123/Messages.json",
    authorization: "Basic " + btoa("AC0123:token"), To: "+447700900982", From: "+447700900000",
    Body: "Portsea Records: Rigger's Yard video. Catalogue reference AV/98/019. Reply STOP to unsubscribe.",
  }]);
  for (const reply of replies) {
    assert.equal(reply.status, "requested");
    assert.doesNotMatch(JSON.stringify(reply), /AV\/98\/019|preview/);
  }
  const kept = JSON.stringify(office.ledger.storage.kv.list());
  assert.doesNotMatch(kept + office.logged.join(), /7700900982|203\.0\.113\.7|token/);
  const [, record] = office.ledger.storage.kv.list({ prefix: "number:" })[0];
  assert.deepEqual(record.requests, [{ at: office.time, consent: consentVersion, sid: "SM1" }]);

  office.time += limits.cooldown;
  assert.equal((await office.ask("07700 900982")).status, "requested");
  assert.equal(office.sent.length, 2);
});

test("a number Twilio rejects can be corrected straight away", async t => {
  const office = openOffice(t);
  office.answer = rejected(21614);
  assert.deepEqual(await office.ask("07700 900982"),
    { code: 422, status: "invalid", field: "mobile", message: "Enter a mobile number that can receive texts" });
  office.answer = accepted;
  assert.equal((await office.ask("07700 900982")).status, "requested");
  assert.equal(office.sent.length, 2);
});

test("a number that replied STOP is left alone until the next day", async t => {
  const office = openOffice(t);
  office.answer = rejected(21610);
  assert.equal((await office.ask("07700 900982")).status, "opted-out");
  office.answer = accepted;
  office.time += limits.cooldown;
  const reply = await office.ask("07700 900982");
  assert.equal(reply.code, 409);
  assert.match(reply.message, /opted out of texts from Portsea Records\. Reply START/);
  assert.equal(office.sent.length, 1);

  office.time += limits.optOutHold;
  assert.equal((await office.ask("07700 900982")).status, "requested");
  assert.equal(office.sent.length, 2);
});

test("an unanswered send holds the number so a refresh cannot text it twice", async t => {
  const office = openOffice(t);
  office.answer = () => { throw new DOMException("timed out", "TimeoutError"); };
  const reply = await office.ask("07700 900982");
  assert.equal(reply.code, 503);
  assert.match(reply.message, /could not confirm that the text was sent.*ask again in 2 minutes/);
  office.answer = accepted;
  assert.equal((await office.ask("07700 900982")).status, "requested");
  assert.equal(office.sent.length, 1);

  office.time += limits.pendingHold;
  await office.ask("07700 900982");
  assert.equal(office.sent.length, 2);
  assert.deepEqual(office.logged, ["text unconfirmed", "text accepted SM1"]);

  office.answer = rejected(20003);
  const refused = await office.ask("07700 900111", { visitor: "203.0.113.8" });
  assert.deepEqual([refused.code, refused.message], [503, "We could not send the text. Try again in a few minutes."]);
});

test("one connection and the whole event each have a limit", async t => {
  const office = openOffice(t, { ...twilio, SMS_SEND_CEILING: "6" });
  for (let last = 0; last < limits.textsPerVisitor; last++) await office.ask("07700 90010" + last);
  office.time += 20 * 60e3;
  const waiting = await office.ask("07700 900200");
  assert.deepEqual([waiting.code, waiting.message], [429, "Too many requests from this connection. Try again in 40 minutes."]);
  assert.equal(office.sent.length, limits.textsPerVisitor);

  assert.equal((await office.ask("07700 900201", { visitor: "203.0.113.8" })).status, "requested");
  const full = await office.ask("07700 900202", { visitor: "203.0.113.8" });
  assert.deepEqual([full.code, full.status], [503, "unavailable"]);
  assert.equal(office.sent.length, 6);

  office.time += 3 * limits.visitWindow;
  office.ledger.ledger.alarm();
  assert.deepEqual(office.ledger.storage.kv.list({ prefix: "visitor:" }), []);
});
