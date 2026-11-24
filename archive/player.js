import { houseFromLink, readHouse } from "./house/library/house-format.js";
import { Sampler } from "./house/music/sampler.js";
import { Transport } from "./house/music/transport.js";

const referenceCopy = readHouse({
  title: "Reference copy", mode: "cassette", band: false,
  rooms: [{ id: "landing", x: 0, z: 0, width: 4, depth: 4, finish: "moonstone" }],
  doors: [],
  pieces: [
    { id: "guitar", kind: "wardrobe", roomId: "landing", x: 0, z: 0, turn: 0, pitch: 50, phrase: "answer" },
    { id: "bass", kind: "mirror", roomId: "landing", x: 1.5, z: 2, turn: 0, pitch: 38 },
    { id: "rim", kind: "lamp", roomId: "landing", x: 2.75, z: 0, turn: 0, hit: "snare" }
  ]
});

function recordingNumber(house) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(JSON.stringify(house))) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  const digits = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return "041a / " + digits.slice(0, 4) + "-" + digits.slice(4);
}

export class TapePlayer {
  #request = 0;
  #timer;

  constructor(deck, sampler = new Sampler()) {
    this.deck = deck;
    this.sampler = sampler;
    this.transport = new Transport(() => sampler.now, sampler);
    this.playButton = deck.querySelector("[data-tape-play]");
    this.action = deck.querySelector("[data-tape-action]");
    this.title = deck.querySelector("[data-tape-title]");
    this.labelName = deck.querySelector("[data-tape-name]");
    this.labelNumber = deck.querySelector("[data-tape-number]");
    this.status = deck.querySelector("[data-tape-status]");
    this.playButton.addEventListener("click", () => this.toggle());

    const document = deck.ownerDocument;
    const page = document.defaultView;
    page.addEventListener("hashchange", ({ oldURL, newURL }) => {
      const recordingChanged = [oldURL, newURL].some(url => new URLSearchParams(new URL(url).hash.slice(1)).has("h"));
      if (recordingChanged) this.open(newURL);
    });
    page.addEventListener("pagehide", () => this.pause());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    this.open(page.location.href);
  }

  open(url) {
    try {
      this.#load(houseFromLink(url) ?? referenceCopy);
    } catch {
      this.pause();
      this.labelName.textContent = "";
      this.labelNumber.textContent = "";
      this.title.textContent = "Unreadable copy";
      this.playButton.disabled = true;
      this.#show("error", "Recording unavailable.");
    }
  }

  #load(house) {
    this.pause();
    this.transport.reset();
    this.transport.setHouse(house);
    this.labelName.textContent = house === referenceCopy ? "Flat below" : house.title;
    this.labelNumber.textContent = house === referenceCopy ? "EH/98/041a" : recordingNumber(house);
    this.title.textContent = house === referenceCopy ? house.title : "Deposited copy · " + house.title;
    this.playButton.disabled = !this.transport.view().events.length;
    this.#show("ready", this.playButton.disabled ? "No notes were recorded on this tape." : "");
  }

  async toggle() {
    if (this.playButton.disabled) return;
    if (["loading", "playing"].includes(this.deck.dataset.state)) {
      this.pause();
      return;
    }
    const request = ++this.#request;
    this.#show("loading", "Loading the recording…");
    try {
      await this.sampler.enable();
      if (request !== this.#request || this.deck.ownerDocument.hidden) return;
      this.transport.play();
      this.#timer = setInterval(() => this.transport.tick(), 25);
      this.#show("playing");
    } catch {
      if (request === this.#request) {
        this.pause();
        this.#show("error", "The recording could not play. Try Play tape again.");
      }
    }
  }

  pause() {
    this.#request++;
    clearInterval(this.#timer);
    this.transport.pause();
    if (["loading", "playing"].includes(this.deck.dataset.state)) this.#show("paused");
  }

  #show(state, message = "") {
    this.deck.dataset.state = state;
    this.action.textContent = state === "playing" ? "Pause tape" : state === "loading" ? "Cancel" : "Play tape";
    this.status.textContent = message;
  }
}

const deck = globalThis.document?.querySelector("[data-tape]");
if (deck) new TapePlayer(deck);
