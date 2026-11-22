import { fittingOf } from "../building/catalogue.js";
import { fittings } from "../building/fittings.js";
import { instrumentName, tuningOptions } from "../music/arrangements.js";
import { phrases } from "../music/phrases.js";
import { icon } from "./elements.js";

class Dial {
  root = document.createElement("div");
  #label = document.createElement("small");
  #value = document.createElement("span");
  #arrows = [];
  #index = 0;
  #choices = [];

  constructor(name, choose) {
    this.root.className = "dial";
    this.root.setAttribute("role", "group");
    this.name = name;
    const readout = document.createElement("div");
    this.#value.setAttribute("aria-live", "polite");
    readout.append(this.#label, this.#value);
    const arrow = (delta, symbol) => {
      const button = document.createElement("button");
      this.#arrows.push(button);
      button.append(icon(symbol));
      button.onclick = () => {
        const i = (this.#index + delta + this.#choices.length) % this.#choices.length;
        choose(this.#choices[i].value);
      };
      return button;
    };
    this.root.append(arrow(-1, "back"), readout, arrow(1, "next"));
  }

  show(choices, value, name = this.name) {
    this.root.setAttribute("aria-label", name);
    this.#label.textContent = name;
    this.#arrows[0].setAttribute("aria-label", "Previous " + name.toLowerCase());
    this.#arrows[1].setAttribute("aria-label", "Next " + name.toLowerCase());
    this.#choices = choices;
    this.#index = choices.findIndex(choice => choice.value === value);
    this.#value.textContent = choices[this.#index]?.label ?? "";
  }
}

export class InstrumentPanel {
  #piece;
  #buttons = new Map();
  #caption = document.createElement("p");

  constructor(root, edit, withPhrases = false) {
    this.root = root;
    const swatches = document.createElement("div");
    swatches.className = "fitting-swatches";
    swatches.setAttribute("role", "group");
    swatches.setAttribute("aria-label", "Instrument");
    for (const [id, fitting] of Object.entries(fittings)) {
      const button = document.createElement("button");
      button.dataset.fitting = id;
      button.style.setProperty("--ink", fitting.colour);
      button.append(icon(id));
      button.onclick = () => edit("fitPiece", this.#piece.id, id);
      swatches.append(button);
      this.#buttons.set(id, button);
    }
    const dials = document.createElement("div");
    dials.className = "dials";
    this.note = new Dial("Note", value => edit("tune", this.#piece.id, value));
    dials.append(this.note.root);
    if (withPhrases) {
      this.phrase = new Dial("Phrase", value => edit("setPhrase", this.#piece.id, value));
      dials.append(this.phrase.root);
    }
    this.#caption.className = "instrument-name";
    root.append(swatches, this.#caption, dials);
  }

  show(piece, house) {
    this.#piece = piece;
    const id = fittingOf(piece), band = house.band !== false;
    for (const [key, button] of this.#buttons) {
      const fitting = fittings[key];
      button.title = instrumentName(house.mode, fitting) + " · " + fitting.label;
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(id === key));
    }
    this.#caption.textContent = this.#buttons.get(id).title;
    this.note.root.hidden = id === "plain";
    if (this.phrase) this.phrase.root.hidden = id === "plain";
    if (id === "plain") return;
    this.note.show(tuningOptions(house.mode, id, band), piece.hit ?? piece.pitch, fittings[id].hits ? "Drum hit" : "Note");
    if (this.phrase) {
      const options = Object.entries(phrases).map(([value, { label }]) => ({ value, label }));
      this.phrase.show([{ value: null, label: band ? "House riff" : "Furniture riff" }, ...options], piece.phrase ?? null);
    }
  }
}
