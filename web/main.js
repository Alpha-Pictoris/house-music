import { HouseEditor } from "./building/house-editor.js";
import { furniture } from "./building/catalogue.js";
import { LookingGlass } from "./building/looking-glass.js";
import { ToolTrays } from "./ui/tool-trays.js";
import { WritingMarks } from "./ui/writing-marks.js";
import { RecordCrate } from "./ui/record-sleeves.js";
import { Sampler } from "./music/sampler.js";
import { ScorePanel } from "./ui/score-panel.js";
import { ObjectPanel } from "./ui/object-panel.js";
import { FurniturePanel } from "./ui/furniture-panel.js";
import { byId } from "./ui/elements.js";
import { Transport } from "./music/transport.js";
import { HouseScene } from "./scene/house-scene.js";
import { BuildControls } from "./ui/build-controls.js";
import { HouseFiles } from "./ui/house-files.js";

const hints = {
  room: "Draw two corners. Start inside a room to extend it.",
  select: "",
  door: "Choose a wall to open a doorway.",
  pan: "Drag to move the map. Use the arrow keys to pan.",
  orbit: "Drag to turn the plot.",
  place: "Choose a spot inside a room."
};

class HouseMusic {
  #playRequest = 0;
  #loading = false;
  #hintTimer;
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
    this.panel = new ScorePanel();
    this.controls = new BuildControls(this.canvas, this.scene, this.editor, text => this.notify(text));
    this.glass = new LookingGlass();
    this.trays = new ToolTrays(this.controls);
    this.furniturePanel = new FurniturePanel(this.controls, this.trays, piece => this.#audition(piece));
    this.objectPanel = new ObjectPanel(this.controls, piece => this.#audition(piece), this.glass);
    this.marks = new WritingMarks(id => {
      this.controls.select(id);
      this.controls.arrange();
    });
    this.records = new RecordCrate(byId("records"), mode => {
      this.editor.setMode(mode);
      this.#audition();
    });
    this.files = new HouseFiles(() => this.editor.house, house => this.open(house), text => this.notify(text));
    this.#wireControls();
    this.files.restore();
    setInterval(() => this.transport.tick(), 25);
    requestAnimationFrame(ms => this.#frame(ms));
  }

  notify(text) {
    clearTimeout(this.#hintTimer);
    const hint = byId("plot-hint");
    hint.textContent = text;
    hint.classList.toggle("visible", Boolean(text));
    if (text) this.#hintTimer = setTimeout(() => hint.classList.remove("visible"), 6000);
  }

  #audition(piece) {
    if (this.transport.playing || this.#loading) return;
    const notes = this.transport.preview(piece);
    this.sampler.audition(notes, this.editor.house.mode).catch(error => this.notify(error.message));
  }

  open(house) {
    this.#playRequest++;
    this.#loading = false;
    this.transport.reset();
    this.sampler.cancelFrom(this.sampler.now, true);
    this.editor.removeEventListener("change", this.#onEdit);
    this.editor = house ? new HouseEditor(house) : new HouseEditor();
    this.editor.addEventListener("change", this.#onEdit);
    this.transport.setHouse(this.editor.house);
    this.objectPanel.close();
    this.marks.reset();
    this.trays.close();
    this.controls.reset(this.editor);
    this.refresh();
  }

  #wireControls() {
    const controls = this.controls;
    controls.addEventListener("change", () => {
      this.refresh();
      if (controls.tool === "place" && controls.kind) {
        const item = furniture[controls.kind];
        const where = item.garden ? " in the garden." : item.layer === "wall" ? " on an outside wall." : " inside a room.";
        this.notify("Place the " + item.label.toLowerCase() + where);
      }
      else this.notify(controls.tool === "room" && !this.editor.house.rooms.length ? "" : hints[controls.tool]);
    });
    controls.addEventListener("play", () => this.togglePlay());
    controls.addEventListener("audition", event => this.#audition(event.detail));
    byId("undo").onclick = () => this.history("undo");
    byId("redo").onclick = () => this.history("redo");
    byId("zoom-in").onclick = () => this.scene.zoom(1.2);
    byId("zoom-out").onclick = () => this.scene.zoom(1 / 1.2);
    byId("fit").onclick = () => this.scene.fit(this.editor.house);
    byId("house-title").onchange = event => {
      this.editor.rename(event.target.value);
      event.target.value = this.editor.house.title;
    };
    byId("house-title").onkeydown = event => { if (event.key === "Enter") event.target.blur(); };
    byId("band").onclick = () => {
      this.sampler.cancelAudition();
      const enabled = this.editor.house.band === false;
      this.editor.setBand(enabled);
      this.notify(enabled ? "House band on. The fittings share a beat and chord progression." : "House band off. The sweep plays each fitting at its exact position.");
    };
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
    this.sampler.cancelAudition();
    this.#playButton();
    try {
      await this.sampler.enable();
      if (request !== this.#playRequest || document.hidden) return;
      this.transport.play();
      if (!this.transport.view().events.length) this.notify("Place a piece with a musical fitting to hear the house.");
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
    byId("current-house").textContent = house.title;
    byId("undo").disabled = !this.editor.canUndo;
    byId("redo").disabled = !this.editor.canRedo;
    this.records.show(house.mode);
    byId("band").setAttribute("aria-pressed", String(house.band !== false));
    this.trays.refresh();
    this.marks.show(this.glass.read(house), controls.selectedPiece, controls.tool);
    this.furniturePanel.refresh(house);
    this.objectPanel.refresh();
    this.#playButton();
  }

  #frame(ms) {
    if (!document.hidden) {
      const view = this.transport.view(), house = this.editor.house;
      byId("empty-guide").hidden = Boolean(house.rooms.length || house.pieces.length || this.controls.preview);
      this.scene.draw({ house: view.house, draftHouse: house, selection: this.controls.selection,
        preview: this.controls.preview, grid: ["room", "door", "place"].includes(this.controls.tool),
        discoveries: this.glass.read(house).discoveries, sweepX: view.sweepX, levels: view.levels,
        beat: this.transport.playing ? view.beat : null, time: ms / 1000 });
      this.marks.project(this.scene.camera);
      this.panel.draw(view);
    }
    requestAnimationFrame(time => this.#frame(time));
  }
}

new HouseMusic();
