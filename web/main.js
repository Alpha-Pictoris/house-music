import { HouseEditor } from "./building/house-editor.js";
import { furniture, newPiece, tunings } from "./building/catalogue.js";
import { arrangements } from "./music/arrangements.js";
import { Sampler } from "./music/sampler.js";
import { Score } from "./music/score.js";
import { Transport } from "./music/transport.js";
import { HouseScene } from "./scene/house-scene.js";
import { BuildControls } from "./ui/build-controls.js";
import { HouseFiles } from "./ui/house-files.js";

const byId = id => document.getElementById(id);
const plural = (count, noun) => count + " " + noun + (count === 1 ? "" : "s");
const hints = {
  room: "Choose the corners of your room.",
  select: "Drag a piece to change its beat. Drag empty floor to orbit.",
  door: "Choose a wall shared by two rooms.",
  orbit: "Drag to turn the plot.",
  place: "Choose a spot inside a room."
};

class PerformancePanel {
  #lastHouse;
  #lastBeat;

  draw(view) {
    if (this.#lastHouse !== view.house) {
      const score = Score.from(view.house);
      const pieces = new Map(view.house.pieces.map(piece => [piece.id, piece]));
      const markers = score.events.map(event => {
        const piece = pieces.get(event.pieceId);
        const marker = document.createElement("i");
        marker.className = "score-note";
        marker.style.left = (100 * event.beat / score.beats) + "%";
        marker.style.width = (100 * (event.gate ?? 0.12) / score.beats) + "%";
        marker.style.top = ({ wardrobe: 3, mirror: 10, lamp: 16 })[piece.kind] + "px";
        marker.style.background = furniture[piece.kind].colour;
        return marker;
      });
      byId("score-events").replaceChildren(...markers);
      byId("score-lanes").style.setProperty("--step", (100 / score.beats) + "%");
      this.#lastHouse = view.house;
      this.#lastBeat = null;
    }
    const beat = Math.min(view.beats, Math.floor(view.beat) + 1);
    if (beat !== this.#lastBeat) byId("beat-readout").textContent = "Beat " + beat + " / " + view.beats;
    this.#lastBeat = beat;
    byId("score-head").style.left = (100 * view.beat / view.beats) + "%";
  }
}

class HouseMusic {
  #playRequest = 0;
  #loading = false;
  #onEdit = () => {
    const house = this.editor.house;
    this.transport.setHouse(house);
    this.refresh();
    this.files.save(house);
  };

  constructor() {
    this.canvas = byId("plot");
    this.editor = new HouseEditor();
    this.scene = new HouseScene(this.canvas);
    this.sampler = new Sampler();
    this.transport = new Transport(() => this.sampler.now, this.sampler);
    this.panel = new PerformancePanel();
    this.controls = new BuildControls(this.canvas, this.scene, this.editor, text => this.notify(text));
    this.files = new HouseFiles(() => this.editor.house, house => this.open(house), text => this.notify(text));
    this.#wireControls();
    this.files.restore();
    setInterval(() => this.transport.tick(), 25);
    requestAnimationFrame(ms => this.#frame(ms));
  }

  notify(text) { byId("plot-hint").textContent = text; }

  open(house) {
    this.#playRequest++;
    this.#loading = false;
    this.transport.reset();
    this.sampler.cancelFrom(this.sampler.now, true);
    this.editor.removeEventListener("change", this.#onEdit);
    this.editor = house ? new HouseEditor(house) : new HouseEditor();
    this.editor.addEventListener("change", this.#onEdit);
    this.transport.setHouse(this.editor.house);
    this.controls.reset(this.editor);
    this.refresh();
  }

  #wireControls() {
    const controls = this.controls;
    controls.addEventListener("change", () => {
      this.refresh();
      if (controls.tool === "place" && controls.kind) this.notify("Place the " + furniture[controls.kind].label.toLowerCase() + " inside a room.");
      else this.notify(hints[controls.tool]);
    });
    controls.addEventListener("play", () => this.togglePlay());
    document.querySelectorAll("[data-tool]").forEach(button => {
      button.onclick = () => {
        controls.use(button.dataset.tool);
        this.canvas.focus({ preventScroll: true });
      };
    });
    document.querySelectorAll(".furniture-card").forEach(card => {
      const kind = card.dataset.kind;
      HouseScene.thumbnail(card.querySelector("canvas"), kind);
      card.onclick = () => {
        this.sampler.audition(newPiece(kind), this.editor.house.mode).catch(error => this.notify(error.message));
        controls.choose(kind);
        this.canvas.focus({ preventScroll: true });
      };
    });
    byId("undo").onclick = () => this.history("undo");
    byId("redo").onclick = () => this.history("redo");
    byId("rotate").onclick = () => controls.rotate();
    byId("duplicate").onclick = () => { controls.duplicate(); this.canvas.focus({ preventScroll: true }); };
    byId("remove").onclick = () => controls.remove();
    byId("zoom-in").onclick = () => this.scene.zoom(1.2);
    byId("zoom-out").onclick = () => this.scene.zoom(1 / 1.2);
    byId("fit").onclick = () => this.scene.fit(this.editor.house);
    byId("selection").onchange = event => controls.select(event.target.value);
    byId("tuning").onchange = event => {
      const piece = controls.selectedPiece;
      if (!piece) return;
      controls.tune(piece.kind === "lamp" ? event.target.value : Number(event.target.value));
      this.sampler.audition(controls.selectedPiece, this.editor.house.mode).catch(error => this.notify(error.message));
    };
    byId("house-title").onchange = event => {
      this.editor.rename(event.target.value);
      event.target.value = this.editor.house.title;
    };
    byId("house-title").onkeydown = event => { if (event.key === "Enter") event.target.blur(); };
    byId("mode").onchange = event => this.editor.setMode(event.target.value);
    byId("play").onclick = () => this.togglePlay();
    document.addEventListener("keydown", event => {
      if (document.querySelector("dialog[open]") || event.target.matches("input,textarea,select")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        this.history(event.shiftKey ? "redo" : "undo");
      }
    });
    const pause = () => {
      this.#playRequest++;
      this.#loading = false;
      this.transport.pause();
      this.sampler.cancelFrom(this.sampler.now, true);
      this.#playButton();
    };
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
    window.addEventListener("pagehide", pause);
  }

  history(method) {
    this.editor[method]();
    this.controls.select(this.controls.selection);
    if (!this.editor.house.rooms.length) this.controls.use("room");
    this.notify(method === "undo" ? "Edit undone." : "Edit restored.");
  }

  async togglePlay() {
    const request = ++this.#playRequest;
    if (this.#loading || this.transport.playing) {
      this.#loading = false;
      this.transport.pause();
      this.#playButton();
      return;
    }
    this.#loading = true;
    this.#playButton();
    try {
      await this.sampler.enable();
      if (request !== this.#playRequest || document.hidden) return;
      this.transport.play();
      if (!this.editor.house.pieces.length) this.notify("Place an instrument to hear the house.");
    } catch (error) { this.notify(error.message); }
    finally {
      if (request === this.#playRequest) { this.#loading = false; this.#playButton(); }
    }
  }

  #playButton() {
    const playing = this.transport.playing;
    const button = byId("play");
    button.setAttribute("aria-pressed", String(playing));
    button.setAttribute("aria-busy", String(this.#loading));
    button.querySelector("use").setAttribute("href", playing ? "#i-pause" : "#i-play");
    button.querySelector("span").textContent = this.#loading ? "Loading" : playing ? "Pause" : "Play";
  }

  refresh() {
    const { house } = this.editor, controls = this.controls;
    const empty = house.rooms.length === 0;
    byId("stage").dataset.empty = String(empty);
    this.canvas.dataset.tool = controls.tool;
    if (document.activeElement !== byId("house-title")) byId("house-title").value = house.title;
    byId("counts").textContent = plural(house.rooms.length, "room") + " · " + plural(house.pieces.length, "piece");
    byId("undo").disabled = !this.editor.canUndo;
    byId("redo").disabled = !this.editor.canRedo;
    byId("mode").value = house.mode;
    byId("bpm").textContent = arrangements[house.mode].bpm;
    document.querySelectorAll("button[data-tool]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.tool === controls.tool));
      button.disabled = button.dataset.tool === "door" && house.rooms.length < 2;
    });
    document.querySelectorAll(".furniture-card").forEach(card => card.setAttribute("aria-pressed", String(controls.kind === card.dataset.kind)));
    const choices = [new Option("Choose an item", "")];
    house.rooms.forEach((item, i) => choices.push(new Option("Room " + (i + 1), item.id)));
    house.doors.forEach((item, i) => choices.push(new Option("Door " + (i + 1), item.id)));
    const quantities = {};
    for (const piece of house.pieces) {
      quantities[piece.kind] = (quantities[piece.kind] ?? 0) + 1;
      choices.push(new Option(furniture[piece.kind].label + " " + quantities[piece.kind], piece.id));
    }
    if (controls.selection && !choices.some(choice => choice.value === controls.selection)) controls.selection = null;
    const selection = byId("selection");
    selection.replaceChildren(...choices);
    selection.value = controls.selection ?? "";
    byId("inspector").hidden = empty;
    const piece = controls.selectedPiece;
    byId("tuning-field").hidden = !piece;
    if (piece) {
      byId("tuning-label").textContent = piece.kind === "lamp" ? "Drum hit" : "Note";
      byId("tuning").replaceChildren(...tunings(piece.kind).map(({ label, value }) => new Option(label, value)));
      byId("tuning").value = piece.hit ?? piece.pitch;
    }
    byId("rotate").disabled = byId("duplicate").disabled = !piece;
    byId("remove").disabled = !controls.selection;
    this.#playButton();
  }

  #frame(ms) {
    if (!document.hidden) {
      const view = this.transport.view(), house = this.editor.house;
      byId("empty-guide").hidden = Boolean(house.rooms.length || this.controls.preview);
      this.scene.draw({ house: view.house, draftHouse: house, selection: this.controls.selection,
        preview: this.controls.preview, sweepX: view.sweepX, levels: view.levels, time: ms / 1000 });
      this.panel.draw(view);
    }
    requestAnimationFrame(time => this.#frame(time));
  }
}

new HouseMusic();
