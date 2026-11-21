import { arrangements } from "./arrangements.js";

const recordings = ["guitar", "bass", "kick", "snare", "hat", "harp", "celesta"];

export class Sampler {
  #context;
  #output;
  #buffers = new Map();
  #loading;
  #voices = new Set();
  #audition = 0;
  #carpet;
  #echo;

  get now() { return this.#context?.currentTime ?? 0; }

  async enable() {
    if (!this.#context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error("Audio is unavailable in this browser.");
      this.#context = new Context();
      this.#output = this.#context.createDynamicsCompressor();
      this.#output.threshold.value = -7;
      this.#output.ratio.value = 5;
      const master = this.#context.createGain();
      master.gain.value = 0.8;
      this.#output.connect(master).connect(this.#context.destination);
      this.#carpet = this.#context.createBiquadFilter();
      this.#carpet.type = "lowpass";
      this.#carpet.frequency.value = 1800;
      this.#carpet.connect(this.#output);
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

  cancelAudition() {
    this.#audition++;
    for (const voice of this.#voices) if (voice.audition) this.#stop(voice, this.now);
  }

  async audition(notes, mode) {
    this.cancelAudition();
    const request = this.#audition;
    if (!notes.length) return;
    await this.enable();
    if (request !== this.#audition || document.hidden) return;
    const { bpm, rate } = arrangements[mode];
    const now = this.now;
    for (const note of notes) this.start(note, now + note.offset * 60 / bpm, bpm, rate, true);
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
    const volume = 0.82 * (event.velocity ?? 1);
    level.gain.setValueAtTime(0, start);
    level.gain.linearRampToValueAtTime(volume, start + 0.003);
    level.gain.setValueAtTime(volume, start + Math.max(0.004, length - 0.025));
    level.gain.linearRampToValueAtTime(0, start + length);
    source.connect(level).connect(event.finish === "moss" ? this.#carpet : this.#output);
    if (event.finish === "moonstone") {
      if (!this.#echo) {
        const delay = context.createDelay(), reflection = context.createGain();
        delay.delayTime.value = 0.135;
        reflection.gain.value = 0.22;
        delay.connect(reflection).connect(this.#output);
        this.#echo = delay;
      }
      level.connect(this.#echo);
    }
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
    if (silence) {
      this.#audition++;
      this.#echo?.disconnect();
      this.#echo = null;
    }
    for (const voice of this.#voices) {
      if (silence || (!voice.audition && voice.start >= when)) this.#stop(voice, when);
    }
  }

  #stop(voice, when) {
    if (voice.stopped) return;
    voice.stopped = true;
    if (voice.start >= when) voice.source.stop(Math.max(when, this.now));
    else {
      voice.level.gain.cancelScheduledValues(when);
      voice.level.gain.setTargetAtTime(0, when, 0.003);
      voice.source.stop(when + 0.02);
    }
  }
}
