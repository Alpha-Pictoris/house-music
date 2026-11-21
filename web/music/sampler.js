import { voiceFor } from "../building/catalogue.js";
import { arrangements } from "./arrangements.js";

const recordings = ["guitar", "bass", "kick", "snare", "hat"];

export class Sampler {
  #context;
  #output;
  #buffers = new Map();
  #loading;
  #voices = new Set();

  get now() { return this.#context?.currentTime ?? 0; }

  async enable() {
    if (!this.#context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error("Audio is unavailable in this browser.");
      this.#context = new Context();
      this.#output = this.#context.createDynamicsCompressor();
      this.#output.threshold.value = -7;
      this.#output.ratio.value = 5;
      this.#output.connect(this.#context.destination);
    }
    const resumed = this.#context.state === "running" ? Promise.resolve() : this.#context.resume();
    if (!this.#loading) {
      this.#loading = Promise.all(recordings.map(async name => {
        if (this.#buffers.has(name)) return;
        const response = await fetch(new URL("../audio/" + name + ".wav", import.meta.url));
        if (!response.ok) throw Error("The instrument recordings could not load. Try Play again.");
        const buffer = await this.#context.decodeAudioData(await response.arrayBuffer());
        this.#buffers.set(name, buffer);
      })).catch(error => { this.#loading = null; throw error; });
    }
    await Promise.all([resumed, this.#loading]);
  }

  async audition(piece, mode) {
    await this.enable();
    const { bpm, rate } = arrangements[mode];
    this.start(voiceFor(piece), this.now, bpm, rate, true);
  }

  start(event, when, bpm, rate, audition = false) {
    const buffer = this.#buffers.get(event.sample);
    if (!buffer) return;
    const context = this.#context;
    const source = context.createBufferSource(), level = context.createGain();
    const speed = rate * 2 ** (event.semitones / 12);
    const start = Math.max(context.currentTime, when);
    const length = Math.min(buffer.duration / speed, event.gate === null ? Infinity : event.gate * 60 / bpm);
    source.buffer = buffer;
    source.playbackRate.value = speed;
    level.gain.setValueAtTime(0, start);
    level.gain.linearRampToValueAtTime(0.82, start + 0.003);
    level.gain.setValueAtTime(0.82, start + Math.max(0.004, length - 0.025));
    level.gain.linearRampToValueAtTime(0, start + length);
    source.connect(level).connect(this.#output);
    const voice = { source, level, start: when, audition, stopped: false };
    this.#voices.add(voice);
    source.onended = () => {
      this.#voices.delete(voice);
      source.disconnect();
      level.disconnect();
    };
    source.start(start);
    source.stop(start + length);
  }

  cancelFrom(when, silence = false) {
    for (const voice of this.#voices) {
      if (voice.stopped || (!silence && (voice.audition || voice.start < when))) continue;
      voice.stopped = true;
      if (voice.start >= when) {
        voice.source.stop(Math.max(when, this.now));
      } else {
        const gain = voice.level.gain;
        gain.cancelScheduledValues(when);
        gain.setTargetAtTime(0, when, 0.003);
        voice.source.stop(when + 0.02);
      }
    }
  }
}
