import { fittingOf, furniture, isSmallObject, newPiece, roomFinishes, tablesAndShelves } from "../building/catalogue.js";
import { fittings } from "../building/fittings.js";
import { phrases } from "../music/phrases.js";
import { instrumentName, tuningOptions } from "../music/arrangements.js";
import { HouseScene } from "../scene/house-scene.js";
import { FurnitureSpots } from "../building/furniture-spots.js";
import { byId, icon } from "./elements.js";

const collectionIcons = {
  Curiosities: "curio", Living: "living", [tablesAndShelves]: "shelf",
  Decor: "decor", Bedroom: "bedroom", Fixtures: "fixtures", Garden: "garden"
};

export class FurniturePanel {
  #details = false;
  #group = "Curiosities";
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
    byId("furniture-search").oninput = () => this.#filterCatalogue();
    byId("browse-tab").onclick = () => this.show(false);
    byId("detail-tab").onclick = () => this.show(true);
    byId("arrange-objects").onclick = () => controls.arrange();
    byId("toggle-catalogue").onclick = () => this.#expand(byId("drawer-body").hidden);
    byId("turn-left").onclick = () => { controls.rotate("left"); this.#focusPlot(); };
    byId("turn-right").onclick = () => { controls.rotate("right"); this.#focusPlot(); };
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
    const catalogue = Object.entries(furniture).filter(([kind]) => !isSmallObject(kind));
    const groups = new Set(catalogue.map(([, item]) => item.group));
    for (const group of groups) {
      const button = document.createElement("button");
      button.append(icon(collectionIcons[group]), group);
      button.dataset.group = group;
      button.onclick = () => this.#openGroup(group);
      byId("furniture-groups").append(button);
    }
    for (const [kind, item] of catalogue) {
      const fitting = fittings[item.fitting];
      const card = byId("furniture-card").content.firstElementChild.cloneNode(true);
      card.dataset.kind = kind;
      card.dataset.collection = item.group;
      card.style.setProperty("--fitting-colour", item.ink ?? fitting.colour);
      card.querySelector("strong").textContent = item.label;
      const spots = FurnitureSpots.slots(kind).length;
      card.querySelector(".material-label").textContent = item.detail ?? (spots ? "Holds " + spots + " objects" : item.garden ? "Outdoors" : fitting.label);
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
    byId("furniture-search").value = "";
    this.#filterCatalogue();
  }

  #filterCatalogue() {
    const query = byId("furniture-search").value.trim().toLowerCase();
    let matches = 0;
    for (const button of byId("furniture-groups").children) button.setAttribute("aria-pressed", String(!query && button.dataset.group === this.#group));
    for (const [kind, card] of this.#cards) {
      const design = furniture[kind], holdsObjects = FurnitureSpots.slots(kind).length > 0;
      const collection = this.#group === tablesAndShelves ? holdsObjects : design.group === this.#group;
      const name = [design.label, design.group, holdsObjects ? tablesAndShelves : ""].join(" ").toLowerCase();
      card.hidden = query ? !name.includes(query) : !collection;
      if (card.hidden) continue;
      matches++;
      const canvas = card.querySelector("canvas");
      if (!canvas.dataset.renderer) HouseScene.thumbnail(canvas, kind);
    }
    byId("no-furniture").hidden = matches > 0;
    byId("furniture-cards").hidden = !matches;
  }

  #buildFittings() {
    for (const [id, fitting] of Object.entries(fittings)) {
      const button = document.createElement("button");
      button.dataset.fitting = id;
      button.style.setProperty("--fitting-colour", fitting.colour);
      const label = { plain: "Plain", thorn: "Thorns", ring: "Rings", stud: "Studs", glass: "Glass", wire: "Strings" }[id];
      button.append(icon(id), label);
      button.onclick = () => this.audition(this.controls.editor.fitPiece(this.controls.selection, id));
      byId("fittings").append(button);
    }
  }

  show(details) {
    this.#details = details;
    this.#expand(true);
    byId("browse-panel").hidden = details;
    byId("inspector").hidden = !details;
    byId("browse-tab").setAttribute("aria-pressed", String(!details));
    byId("detail-tab").setAttribute("aria-pressed", String(details));
  }

  #expand(open) {
    byId("drawer-body").hidden = !open;
    byId("search-field").hidden = !open || this.#details;
    const button = byId("toggle-catalogue");
    button.setAttribute("aria-expanded", String(open));
    button.title = open ? "Hide catalogue" : "Show catalogue";
    button.setAttribute("aria-label", button.title);
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
        const sound = instrumentName(house.mode, fitting);
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
    byId("arrange-objects").hidden = !piece || !FurnitureSpots.slots(piece.kind).length;
    if (indoor) {
      const id = fittingOf(piece), fitting = fittings[id];
      const relative = house.band !== false;
      const key = [id, house.mode, relative].join("/");
      if (this.#lastFitting !== key) {
        for (const button of byId("fittings").children) button.setAttribute("aria-pressed", String(button.dataset.fitting === id));
        byId("tuning").replaceChildren(...tuningOptions(house.mode, id, relative).map(option => new Option(option.label, option.value)));
        this.#lastFitting = key;
      }
      byId("fitting-sound").textContent = byId("fittings").querySelector('[data-fitting="' + id + '"]').title;
      byId("tuning-field").hidden = id === "plain";
      byId("tuning-label").textContent = fitting.hits ? "Drum hit" : "First note";
      byId("tuning").value = piece.hit ?? piece.pitch ?? "";
      byId("phrase").options[0].text = house.band === false ? "Furniture default" : "House riff";
      byId("phrase").value = piece.phrase ?? "";
    }
    const rotating = controls.rotatingPiece;
    byId("rotation").hidden = !rotating;
    if (rotating) {
      byId("turn-piece").textContent = furniture[rotating.kind].label;
      byId("turn-angle").textContent = ((4 - rotating.turn) % 4) * 90 + "°";
    }
    byId("duplicate").disabled = !piece;
    byId("remove").disabled = !controls.selection;
  }
}
