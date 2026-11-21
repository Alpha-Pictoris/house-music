import { fittings } from "../building/fittings.js";
import { byId } from "./elements.js";

const lanes = { thorn: 2, ring: 6, stud: 10, glass: 14, wire: 18 };

export class ScorePanel {
  #events;
  #beat;
  #head = byId("score-head");
  #readout = byId("beat-readout");

  draw(view) {
    if (!this.#head.closest("details").open) return;
    if (this.#events !== view.events) {
      const markers = view.events.map(event => {
        const marker = document.createElement("i");
        marker.className = "score-note";
        marker.style.left = (100 * event.beat / view.beats) + "%";
        marker.style.width = (100 * (event.gate ?? 0.12) / view.beats) + "%";
        marker.style.top = lanes[event.fitting] + "px";
        marker.style.background = fittings[event.fitting].colour;
        if (event.pieceId === null) marker.style.opacity = "0.45";
        return marker;
      });
      byId("score-events").replaceChildren(...markers);
      byId("score-lanes").style.setProperty("--step", (100 / view.beats) + "%");
      this.#events = view.events;
      this.#beat = null;
    }
    const beat = Math.min(view.beats, Math.floor(view.beat) + 1);
    if (beat !== this.#beat) this.#readout.textContent = "Beat " + beat + " / " + view.beats;
    this.#beat = beat;
    this.#head.style.left = (100 * view.beat / view.beats) + "%";
  }
}
