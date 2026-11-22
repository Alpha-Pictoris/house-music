import { fittingOf, furniture, newPiece, roomFinishes } from "../building/catalogue.js";
import { fittings, tunings } from "../building/fittings.js";
import { phrases } from "../music/phrases.js";
import { recordingFor, recordingNames } from "../music/arrangements.js";
import { HouseScene } from "../scene/house-scene.js";
import { Surfaces } from "../building/surfaces.js";
import { byId } from "./elements.js";

export class FurniturePanel {
  #details = false;
  #group = "Living";
  #cards = new Map();
  #lastHouse;
  #lastKind;
  #lastFitting;
  #lastMode;

  constructor(controls, audition) {
    this.controls = controls;
    this.audition = audition;
    this.#buildCatalogue();
    this.#buildFittings();
    byId("browse-tab").onclick = () => this.show(false);
    byId("detail-tab").onclick = () => this.show(true);
    byId("arrange-surface").onclick = () => controls.arrange();
    byId("rotate").onclick = () => controls.rotate();
    byId("rotate-preview").onclick = () => controls.rotate();
    byId("duplicate").onclick = () => { controls.duplicate(); this.show(false); this.#focusPlot(); };
    byId("remove").onclick = () => controls.remove();
    byId("selection").onchange = event => controls.select(event.target.value);
    byId("room-name").onchange = event => controls.editor.styleRoom(controls.selection, { name: event.target.value });
    byId("room-finish").onchange = event => controls.editor.styleRoom(controls.selection, { finish: event.target.value });
    byId("phrase").onchange = event => {
      const piece = controls.editor.setPhrase(controls.selection, event.target.value || null);
      this.audition(piece);
    };
    byId("tuning").onchange = event => {
      const piece = controls.selectedPiece;
      if (!piece) return;
      const value = event.target.value;
      controls.tune(fittings[fittingOf(piece)].hits ? value : Number(value));
      this.audition(controls.selectedPiece);
    };
    for (const [id, finish] of Object.entries(roomFinishes)) byId("room-finish").add(new Option(finish.label, id));
    byId("phrase").add(new Option("House riff", ""));
    for (const [id, phrase] of Object.entries(phrases)) byId("phrase").add(new Option(phrase.label, id));
  }

  #focusPlot() {
    const canvas = this.controls.canvas;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.bottom < innerHeight * 0.35 || bounds.top > innerHeight * 0.7) {
      canvas.scrollIntoView({ block: "center" });
    }
    canvas.focus({ preventScroll: true });
  }

  #buildCatalogue() {
    const catalogue = Object.entries(furniture).filter(([, item]) => item.layer !== "surface");
    const groups = new Set(catalogue.map(([, item]) => item.group));
    for (const group of groups) {
      const button = document.createElement("button");
      button.textContent = group;
      button.dataset.group = group;
      button.onclick = () => this.#openGroup(group);
      byId("furniture-groups").append(button);
    }
    for (const [kind, item] of catalogue) {
      const fitting = fittings[item.fitting];
      const card = byId("furniture-card").content.firstElementChild.cloneNode(true);
      card.dataset.kind = kind;
      card.style.setProperty("--voice", fitting.colour);
      card.querySelector("strong").textContent = item.label;
      const spots = Surfaces.slots(kind).length;
      card.querySelector(".material-label").textContent = spots ? "Surface · " + spots + " spots" : item.garden ? "Outdoors" : fitting.label;
      card.onclick = () => {
        this.audition(newPiece(kind));
        this.controls.choose(kind);
        this.#focusPlot();
      };
      byId("furniture-cards").append(card);
      this.#cards.set(kind, card);
    }
    this.#openGroup(this.#group);
  }

  #openGroup(group) {
    this.#group = group;
    for (const button of byId("furniture-groups").children) button.setAttribute("aria-pressed", String(button.dataset.group === group));
    for (const [kind, card] of this.#cards) {
      card.hidden = group === "Surfaces" ? !Surfaces.slots(kind).length : furniture[kind].group !== group;
      const canvas = card.querySelector("canvas");
      if (!card.hidden && !canvas.dataset.renderer) HouseScene.thumbnail(canvas, kind);
    }
  }

  #buildFittings() {
    for (const [id, fitting] of Object.entries(fittings)) {
      const button = document.createElement("button");
      button.dataset.fitting = id;
      button.style.setProperty("--voice", fitting.colour);
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const use = document.createElementNS(icon.namespaceURI, "use");
      use.setAttribute("href", "#i-" + id);
      icon.setAttribute("class", "icon");
      icon.setAttribute("aria-hidden", "true");
      icon.append(use);
      const label = { plain: "Plain", thorn: "Thorns", ring: "Rings", stud: "Studs", glass: "Glass", wire: "Strings" }[id];
      button.append(icon, label);
      button.onclick = () => this.audition(this.controls.editor.fitPiece(this.controls.selection, id));
      byId("fittings").append(button);
    }
  }

  show(details) {
    this.#details = details;
    byId("browse-panel").hidden = details;
    byId("inspector").hidden = !details;
    byId("browse-tab").setAttribute("aria-pressed", String(!details));
    byId("detail-tab").setAttribute("aria-pressed", String(details));
  }

  #choices(house) {
    const choices = [new Option("Choose an item", "")];
    house.rooms.forEach((room, i) => choices.push(new Option(room.name || "Room " + (i + 1), room.id)));
    house.doors.forEach((door, i) => choices.push(new Option("Door " + (i + 1), door.id)));
    const quantities = {};
    for (const piece of house.pieces) {
      quantities[piece.kind] = (quantities[piece.kind] ?? 0) + 1;
      choices.push(new Option(furniture[piece.kind].label + " " + quantities[piece.kind], piece.id));
    }
    const select = byId("selection");
    select.replaceChildren(...choices);
    if (!choices.some(choice => choice.value === this.controls.selection)) this.controls.selection = null;
    this.#lastHouse = house;
  }

  refresh(house) {
    const controls = this.controls;
    const changedMode = this.#lastMode !== house.mode;
    if (changedMode) {
      for (const button of byId("fittings").children) {
        const fitting = fittings[button.dataset.fitting];
        const sound = fitting.sample ? recordingNames[recordingFor(house.mode, fitting.sample)] : fitting.voice;
        button.title = fitting.label + " · " + sound;
        button.setAttribute("aria-label", button.title);
      }
      this.#lastMode = house.mode;
    }
    if (this.#lastHouse !== house) this.#choices(house);
    if (this.#lastKind !== controls.kind) {
      for (const [kind, card] of this.#cards) card.setAttribute("aria-pressed", String(controls.kind === kind));
      this.#lastKind = controls.kind;
    }
    byId("selection").value = controls.selection ?? "";
    const room = house.rooms.find(item => item.id === controls.selection), piece = controls.selectedPiece;
    const indoor = piece && !furniture[piece.kind].garden;
    byId("detail-tab").disabled = !house.rooms.length && !house.pieces.length;
    byId("detail-tab").textContent = room ? "Style room" : indoor ? "Fittings" : "Details";
    if (byId("detail-tab").disabled && this.#details) this.show(false);
    byId("room-fields").hidden = !room;
    if (room) {
      const finish = room.finish ?? "walnut";
      byId("room-name").value = room.name ?? "";
      byId("room-finish").value = finish;
      byId("room-sound").textContent = roomFinishes[finish].sound;
    }
    byId("piece-fields").hidden = !indoor;
    byId("arrange-surface").hidden = !piece || !Surfaces.slots(piece.kind).length;
    if (indoor) {
      const id = fittingOf(piece), fitting = fittings[id];
      const relative = house.band !== false;
      const key = [id, house.mode, relative].join("/");
      if (this.#lastFitting !== key) {
        for (const button of byId("fittings").children) button.setAttribute("aria-pressed", String(button.dataset.fitting === id));
        byId("tuning").replaceChildren(...tunings(id, relative).map(option => new Option(
          fitting.hits ? recordingNames[recordingFor(house.mode, option.value)] : option.label, option.value)));
        this.#lastFitting = key;
      }
      byId("fitting-sound").textContent = byId("fittings").querySelector('[data-fitting="' + id + '"]').title;
      byId("tuning-field").hidden = id === "plain";
      byId("tuning-label").textContent = fitting.hits ? "Drum hit" : relative ? "Starting degree" : "Root note";
      byId("tuning").value = piece.hit ?? piece.pitch ?? "";
      byId("phrase").options[0].text = house.band === false ? "Furniture default" : "House riff";
      byId("phrase").value = piece.phrase ?? "";
    }
    byId("rotate").disabled = !piece || furniture[piece.kind].layer === "wall";
    byId("rotate-preview").hidden = controls.tool !== "place" || !controls.kind || furniture[controls.kind].layer === "wall";
    byId("duplicate").disabled = !piece;
    byId("remove").disabled = !controls.selection;
  }
}
