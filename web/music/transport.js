import { arrangements, defaultMode } from "./arrangements.js";
import { Score } from "./score.js";

const lookahead = 0.1;
const downbeatGrace = 0.025;
const near = 1e-9;

export class Transport {
  #clock;
  #sink;
  #score;
  #next;
  #origin = 0;
  #queuedUntil = 0;
  #cursor = 0;
  #pass = 0;
  #played = false;
  #pulses = [];
  playing = false;
  mode = defaultMode;

  constructor(clock, sink) {
    this.#clock = clock;
    this.#sink = sink;
  }

  get #seconds() { return 60 / arrangements[this.mode].bpm; }
  get #boundary() { return this.#origin + this.#score.beats * this.#seconds; }

  #advance(now) {
    if (!this.playing || now < this.#boundary) return;
    const boundary = this.#boundary;
    this.#score = this.#next;
    const period = this.#score.beats * this.#seconds;
    const skipped = Math.floor((now - boundary) / period);
    this.#pass += 1 + skipped;
    this.#origin = boundary + skipped * period;
  }

  #beat(now) {
    return this.playing ? Math.max(0, (now - this.#origin) / this.#seconds) : this.#cursor;
  }

  #cancel(time, silence = false) {
    this.#sink.cancelFrom(time, silence);
    this.#pulses = silence ? [] : this.#pulses.filter(pulse => pulse.time < time);
    this.#queuedUntil = Math.min(this.#queuedUntil, time);
  }

  setHouse(house, now = this.#clock()) {
    this.#advance(now);
    const next = Score.from(house);
    if (!this.playing) {
      const x = this.#score ? this.#score.left + this.#cursor : next.left;
      this.#cursor = this.#played && x >= next.left && x < next.left + next.beats ? x - next.left : 0;
      this.#score = this.#next = next;
      this.mode = house.mode;
      return;
    }
    const sounding = this.#score.house;
    const changedStyle = this.mode !== house.mode || (sounding.band !== false) !== (house.band !== false);
    if (changedStyle) {
      const x = this.#score.left + this.#beat(now);
      this.#cancel(now, true);
      this.mode = house.mode;
      const sameLayout = sounding.rooms === house.rooms && sounding.pieces === house.pieces && sounding.doors === house.doors;
      this.#score = sameLayout ? next : Score.from({ ...sounding, band: house.band, mode: house.mode });
      const beat = x >= this.#score.left && x < this.#score.left + this.#score.beats ? x - this.#score.left : 0;
      this.#origin = now - beat * this.#seconds;
      this.#queuedUntil = now;
    }
    this.#next = next;
    if (this.#queuedUntil > this.#boundary) this.#cancel(this.#boundary);
    this.tick(now);
  }

  setMode(mode, now = this.#clock()) {
    if (mode !== this.mode && this.#next) this.setHouse({ ...this.#next.house, mode }, now);
  }

  preview(piece) {
    return this.#score.preview(piece, this.#pass);
  }

  play() {
    if (this.playing || !this.#score) return;
    const now = this.#clock();
    this.#origin = now - this.#cursor * this.#seconds;
    this.#queuedUntil = now;
    this.playing = this.#played = true;
    this.tick(now);
  }

  pause() {
    if (!this.playing) return;
    const now = this.#clock();
    this.#advance(now);
    const x = this.#score.left + this.#beat(now);
    this.#cancel(now, true);
    this.#score = this.#next;
    this.#cursor = x >= this.#score.left && x < this.#score.left + this.#score.beats ? x - this.#score.left : 0;
    this.playing = false;
  }

  reset() {
    this.pause();
    this.#played = false;
    this.#cursor = 0;
    this.#pass = 0;
  }

  #schedule(score, origin, from, until, now, pass) {
    for (const event of score.eventsFor(pass)) {
      const when = origin + event.beat * this.#seconds;
      if (when < from - near) continue;
      if (when >= until - near) break;
      const start = Math.max(when, now);
      this.#sink.start(event, start, this.mode);
      if (event.pieceId !== null) {
        for (const id of event.together ?? [event.pieceId]) {
          this.#pulses.push({ id, time: start, span: (event.gate ?? 0.45) * this.#seconds });
        }
      }
    }
  }

  tick(now = this.#clock()) {
    if (!this.playing) return;
    this.#advance(now);
    const earliest = this.#origin >= now - downbeatGrace ? this.#origin : now;
    const from = Math.max(this.#queuedUntil, earliest), until = now + lookahead;
    const boundary = this.#boundary;
    this.#schedule(this.#score, this.#origin, from, Math.min(until, boundary), now, this.#pass);
    if (until > boundary) this.#schedule(this.#next, boundary, Math.max(from, boundary), until, now, this.#pass + 1);
    this.#queuedUntil = until;
    this.#pulses = this.#pulses.filter(pulse => pulse.time + pulse.span + 0.1 >= now);
  }

  view(now = this.#clock()) {
    this.#advance(now);
    const beat = this.#beat(now);
    const levels = new Map();
    for (const pulse of this.#pulses) {
      const age = now - pulse.time;
      if (age >= 0 && age <= pulse.span) {
        const weight = Math.min(1, age / 0.02) * Math.exp(-3 * age / pulse.span);
        levels.set(pulse.id, Math.max(weight, levels.get(pulse.id) ?? 0));
      }
    }
    return {
      house: this.#score.house, events: this.#score.eventsFor(this.#pass), beat, beats: this.#score.beats,
      sweepX: this.#played ? this.#score.left + beat : null, levels
    };
  }
}
