import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { arrangements, recordingFor, recordingNames } from "../../web/music/arrangements.js";
import { responses } from "../../web/music/responses.js";

test("the five arrangements use named instrument recordings", () => {
  const used = new Set();
  for (const mode of Object.keys(arrangements)) {
    for (const part of responses[mode]) used.add(part.recording);
    for (const part of ["guitar", "bass", "celesta", "harp", "kick", "snare", "hat"]) {
      used.add(recordingFor(mode, part));
    }
  }
  const files = readdirSync(new URL("../../web/audio/", import.meta.url));
  assert.deepEqual(used, new Set(Object.keys(recordingNames)));
  assert.deepEqual(new Set([...used].map(name => name + ".wav")), new Set(files.filter(name => name.endsWith(".wav"))));
});
