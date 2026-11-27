import { furniture, newPiece, roomFinishes, tablesAndShelves } from "../building/catalogue.js";
import { FurnitureSpots } from "../building/furniture-spots.js";
import { HouseScene } from "../scene/house-scene.js";
import { byId } from "./elements.js";
import { InstrumentPanel } from "./instrument-panel.js";

const collections = ["Living", "Bedroom", tablesAndShelves, "Decor", "Fixtures", "Garden"];

export class FurniturePanel {
  #collection = 0;
  #cards = new Map();

  constructor(controls, trays, audition) {
    this.controls = controls;
    this.trays = trays;
    this.audition = audition;
    this.#buildCatalogue();
    this.#dragFromCatalogue();
    this.#showCollection(0);
    byId("group-back").onclick = () => this.#showCollection(-1);
    byId("group-next").onclick = () => this.#showCollection(1);
    this.sound = new InstrumentPanel(byId("piece-sound"), (method, id, value) => {
      audition(controls.editor[method](id, value));
    }, true);
    for (const [id, { label, sound }] of Object.entries(roomFinishes)) {
      const button = document.createElement("button");
      button.dataset.finish = id;
      button.textContent = label;
      button.title = label + " · " + sound;
      button.onclick = () => controls.editor.styleRoom(controls.selection, { finish: id });
      byId("room-finishes").append(button);
    }
    byId("room-name").onchange = event => controls.editor.styleRoom(controls.selection, { name: event.target.value });
    byId("detail-button").onclick = event => trays.open("detail", event.currentTarget);
    byId("arrange-objects").onclick = () => controls.arrange();
    byId("call-shadow").onclick = () => { controls.callShadow(); this.#focusPlot(); };
    byId("turn-right").onclick = () => { controls.rotate("right"); this.#focusPlot(); };
    byId("cancel-placement").onclick = () => { controls.select(null); this.#focusPlot(); };
    byId("duplicate").onclick = () => { controls.duplicate(); trays.close(); this.#focusPlot(); };
    byId("remove").onclick = () => { controls.remove(); trays.close(); this.#focusPlot(); };
  }

  #focusPlot() { this.controls.canvas.focus({ preventScroll: true }); }

  #buildCatalogue() {
    for (const [kind, item] of Object.entries(furniture)) {
      if (!collections.includes(item.group)) continue;
      const card = document.createElement("button"), canvas = document.createElement("canvas");
      const label = document.createElement("span");
      card.dataset.kind = kind;
      canvas.setAttribute("aria-hidden", "true");
      label.textContent = item.label;
      card.append(canvas, label);
      card.onclick = () => {
        this.controls.choose(kind);
        this.trays.close();
        this.#focusPlot();
        if (this.controls.kind) this.audition(newPiece(kind));
      };
      byId("furniture-cards").append(card);
      this.#cards.set(kind, card);
    }
  }

  #dragFromCatalogue() {
    const portraits = byId("furniture-cards");
    let press;
    let carrying = false;
    // A native fling can consume the next tap after a drop.
    portraits.addEventListener("touchmove", event => {
      if (carrying && event.cancelable) event.preventDefault();
    }, { passive: false });
    portraits.onpointerdown = event => {
      if (!event.isPrimary || event.button !== 0) return;
      carrying = false;
      const card = event.target.closest("button[data-kind]");
      if (!card) return;
      press = { card, id: event.pointerId, x: event.clientX, y: event.clientY };
      card.setPointerCapture(event.pointerId);
    };
    portraits.onpointermove = event => {
      if (event.pointerId !== press?.id) return;
      const rise = press.y - event.clientY;
      if (rise < 9 || rise < Math.abs(event.clientX - press.x) * 0.65) return;
      carrying = true;
      this.controls.carry(press.card.dataset.kind, event);
      press = null;
      this.trays.close();
      this.#focusPlot();
    };
    portraits.onlostpointercapture = () => { press = null; };
  }

  #showCollection(delta) {
    this.#collection = (this.#collection + delta + collections.length) % collections.length;
    const group = collections[this.#collection];
    byId("group-name").textContent = group;
    byId("furniture-cards").scrollLeft = 0;
    for (const [kind, card] of this.#cards) {
      card.hidden = group === tablesAndShelves ? !FurnitureSpots.slots(kind).length : furniture[kind].group !== group;
      const canvas = card.firstChild;
      if (!card.hidden && !canvas.dataset.renderer) HouseScene.thumbnail(canvas, kind);
    }
  }

  refresh(house) {
    const controls = this.controls;
    const placing = controls.tool === "place" && controls.kind;
    const room = house.rooms.find(item => item.id === controls.selection);
    const piece = controls.selectedPiece, door = house.doors.find(item => item.id === controls.selection);
    const label = placing ? furniture[controls.kind].label : piece ? furniture[piece.kind].label
      : room ? room.name || "Room " + (house.rooms.indexOf(room) + 1) : door ? "Doorway" : "";
    const selected = controls.tool === "select" && Boolean(label);
    const indoor = piece && !furniture[piece.kind].garden;
    byId("context").hidden = !(placing || selected);
    byId("selection-name").textContent = label;
    byId("turn-right").hidden = !controls.rotatingPiece;
    byId("arrange-objects").hidden = !selected || !piece || controls.flipped || !FurnitureSpots.slots(piece.kind).length;
    byId("call-shadow").hidden = !controls.shadowPiece?.shadow;
    const detail = byId("detail-button");
    detail.hidden = !selected || controls.flipped;
    detail.lastChild.textContent = room ? "Style" : indoor ? "Fittings" : "Edit";
    byId("cancel-placement").hidden = !placing;
    if (!selected && this.trays.active === "detail") this.trays.close();
    byId("detail-title").textContent = label;
    byId("room-fields").hidden = !room;
    if (room) {
      if (document.activeElement !== byId("room-name")) byId("room-name").value = room.name ?? "";
      for (const button of byId("room-finishes").children) {
        button.setAttribute("aria-pressed", String(button.dataset.finish === (room.finish ?? "walnut")));
      }
    }
    byId("piece-sound").hidden = !indoor;
    if (indoor) this.sound.show(piece, house);
    byId("duplicate").hidden = !piece;
  }
}
