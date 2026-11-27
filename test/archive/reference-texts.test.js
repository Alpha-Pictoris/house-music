import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { officeSettings, writtenNumber } from "../../archive-worker/office-settings.js";
import { RecordOffice } from "../../archive-worker/record-office.js";
import { limits } from "../../archive-worker/request-ledger.js";
import { TwilioSignature } from "../../archive-worker/twilio-signature.js";
import { memoryLedger } from "../../scripts/archive-stand-ins.mjs";

const address = "https://archive.example/texts";
const token = "auth-token";
const silence = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const reference = '<?xml version="1.0" encoding="UTF-8"?><Response>'
  + "<Message>Portsea Records: Rigger's Yard video. Catalogue reference AV/98/019.</Message></Response>";

function sign(fields, key = token, url = address) {
  const signed = url + Object.keys(fields).sort().map(name => name + fields[name]).join("");
  return createHmac("sha1", key).update(signed).digest("base64");
}

// An archive that Twilio passes texts on to. `text` is one text from a handset.
function openOffice(t, secrets = { TWILIO_AUTH_TOKEN: token }) {
  const office = { time: Date.UTC(2026, 10, 27, 12), logged: [] };
  for (const method of ["log", "error"]) t.mock.method(console, method, (...words) => office.logged.push(words.join(" ")));
  const now = () => office.time;
  const env = { ...secrets, ASSETS: { fetch: async () => Response.json(officeSettings({ SMS_SENDER_NAME: "Portsea Records" })) } };
  office.ledger = env.LEDGER = memoryLedger(env, now);
  const desk = new RecordOffice(env, { now });
  office.text = async (from, body = "Hello", signature) => {
    const fields = { From: from, To: "+447700900982", Body: body, MessageSid: "SM1" };
    const response = await desk.fetch(new Request(address, {
      method: "POST", headers: { "X-Twilio-Signature": signature ?? sign(fields) }, body: new URLSearchParams(fields),
    }));
    return { code: response.status, type: response.headers.get("Content-Type"), reply: await response.text() };
  };
  return office;
}

test("the signature check accepts the example in Twilio's documentation", async () => {
  const fields = { Digits: "1234", To: "+18005551212", From: "+14158675310", Caller: "+14158675310", CallSid: "CA1234567890ABCDE" };
  const check = new TwilioSignature("12345");
  const url = "https://example.com/myapp.php?foo=1&bar=2";
  assert.equal(await check.genuine(url, Object.entries(fields), "L/OH5YylLD5NRKLltdqwSvS0BnU="), true);
  assert.equal(await check.genuine(url, Object.entries({ ...fields, Digits: "1235" }), "L/OH5YylLD5NRKLltdqwSvS0BnU="), false);
});

test("a text to the number on the label is answered with the video reference", async t => {
  const office = openOffice(t);
  assert.deepEqual(await office.text("+447700900001"), { code: 200, type: "text/xml; charset=utf-8", reply: reference });
});

test("only a text signed by Twilio gets the reference", async t => {
  const office = openOffice(t);
  const fields = { From: "+447700900001", To: "+447700900982", Body: "Hello", MessageSid: "SM1" };
  for (const signature of ["", "not base64 %", sign(fields, "another-token"), sign({ ...fields, From: "+447700900002" })]) {
    const refused = await office.text("+447700900001", "Hello", signature);
    assert.equal(refused.code, 403);
    assert.doesNotMatch(refused.reply, /AV\/98\/019/);
  }
  const unset = await openOffice(t, {}).text("+447700900001");
  assert.equal(unset.code, 503);
  assert.doesNotMatch(unset.reply, /AV\/98\/019/);
});

test("a second text inside two minutes and the words Twilio answers itself get no reply", async t => {
  const office = openOffice(t);
  const [first, second] = await Promise.all([office.text("+447700900001"), office.text("+447700900001")]);
  assert.deepEqual([first.reply, second.reply].sort(), [reference, silence].sort());
  assert.equal((await office.text("+447700900001")).reply, silence);
  assert.equal((await office.text("+447700900002")).reply, reference);
  for (const word of ["STOP", " stop ", "Help", "START"]) assert.equal((await office.text("+447700900003", word)).reply, silence);

  office.time += limits.cooldown;
  assert.equal((await office.text("+447700900001")).reply, reference);
});

test("the archive stops answering at the ceiling for the event", async t => {
  const office = openOffice(t, { TWILIO_AUTH_TOKEN: token, SMS_SEND_CEILING: "2" });
  const replies = [];
  for (const last of [1, 2, 3]) replies.push((await office.text("+44770090000" + last)).reply);
  assert.deepEqual(replies, [reference, reference, silence]);
});

test("the ledger and the log keep no telephone number", async t => {
  const office = openOffice(t);
  await office.text("+447700900001");
  await office.text("+447700900001", "STOP");
  const kept = JSON.stringify([...office.ledger.storage.kv.list()]) + office.logged.join("\n");
  assert.doesNotMatch(kept, /7700900001/);
  assert.match(kept, /number:[0-9a-f]{64}/);
});

test("the label shows a UK mobile the way it would be written", () => {
  assert.equal(writtenNumber("+447700900982"), "07700 900982");
  assert.equal(writtenNumber("+12025550143"), "+12025550143");
  assert.equal(officeSettings({}).number, null);
  assert.throws(() => officeSettings({ SMS_NUMBER: "07700 900982" }), /Set SMS_NUMBER to the number that answers texts/);
});
