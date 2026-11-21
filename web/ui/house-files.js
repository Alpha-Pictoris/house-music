import { HouseLibrary } from "../library/house-library.js";
import { houseFromLink, houseLink, houseText, readHouse } from "../library/house-format.js";
import { nightGarden } from "../houses/night-garden.js";

import { byId } from "./elements.js";

export class HouseFiles {
  #id = null;
  #draft = false;

  constructor(getHouse, showHouse, notify) {
    this.getHouse = getHouse;
    this.showHouse = showHouse;
    this.notify = notify;
    let storage;
    try { storage = window.localStorage; } catch { storage = null; }
    this.library = new HouseLibrary(storage);
    for (const name of ["library", "share", "help"]) {
      const dialog = byId(name + "-dialog");
      byId("close-" + name).onclick = () => dialog.close();
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
      });
    }
    byId("library-button").onclick = () => this.showLibrary();
    byId("share-button").onclick = () => this.share();
    byId("help-button").onclick = () => byId("help-dialog").showModal();
    byId("new-house").onclick = () => {
      this.#clearLink();
      this.#load(null, null, false);
      this.save(this.getHouse());
      byId("library-dialog").close();
    };
    byId("open-file").onclick = () => byId("file-input").click();
    byId("file-input").onchange = event => this.#readFile(event.target);
    byId("keep-copy").onclick = () => this.keep();
    byId("return-home").onclick = () => { this.#clearLink(); this.restore(); };
    byId("copy-url").onclick = () => this.#copy();
    byId("download").onclick = () => this.download();
    window.addEventListener("hashchange", () => this.restore());
  }

  #clearLink() {
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.delete("visit");
    history.replaceState(null, "", url);
  }

  #load(house, id, draft) {
    this.#id = id;
    this.#draft = draft;
    this.#saveStatus("");
    this.showHouse(house);
    byId("draft-bar").hidden = !draft;
    byId("draft-label").textContent = "Shared house";
  }

  restore() {
    try {
      const shared = houseFromLink(location.href);
      if (shared) { this.#load(shared, null, true); return; }
      if (new URL(location.href).searchParams.get("visit") === "night-garden") {
        this.#load(readHouse(nightGarden), null, true);
        byId("draft-label").textContent = "Visiting Night Garden";
        return;
      }
      const local = this.library.current();
      this.#load(local?.house, local?.id ?? null, false);
    } catch (error) {
      this.#load(null, null, true);
      byId("draft-label").textContent = "Unsaved house";
      this.notify(error.message);
    }
  }

  save(house) {
    if (this.#draft) return;
    try {
      this.#id = this.library.save(this.#id, house);
      this.#saveStatus("");
    } catch (error) { this.#saveStatus(error.message); }
  }

  #saveStatus(message) {
    const status = byId("save-status");
    status.textContent = message;
    status.hidden = !message;
  }

  keep() {
    try {
      this.#id = this.library.save(null, this.getHouse());
      this.#draft = false;
      this.#saveStatus("");
      this.#clearLink();
      byId("draft-bar").hidden = true;
      this.notify("Copy saved to your library.");
    } catch (error) { this.#saveStatus(error.message); }
  }

  showLibrary() {
    const list = byId("house-list");
    list.replaceChildren();
    try {
      const houses = this.library.list();
      for (const entry of houses) {
        const button = document.createElement("button");
        button.textContent = entry.title;
        if (entry.id === this.#id) button.setAttribute("aria-current", "true");
        button.onclick = () => {
          try {
            const saved = this.library.open(entry.id);
            this.#clearLink();
            this.#load(saved.house, saved.id, false);
            byId("library-dialog").close();
          } catch (error) { list.textContent = error.message; }
        };
        list.append(button);
      }
      if (!houses.length) list.textContent = "Draw a room to start your first saved house.";
    } catch (error) { list.textContent = error.message; }
    byId("library-dialog").showModal();
  }

  async #readFile(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      let data;
      try { data = JSON.parse(await file.text()); } catch { throw Error("Choose a readable house JSON file."); }
      const house = readHouse(data);
      this.#clearLink();
      this.#load(house, null, true);
      byId("draft-label").textContent = "Imported house";
      byId("library-dialog").close();
    } catch (error) { byId("house-list").textContent = error.message; }
    finally { input.value = ""; }
  }

  share() {
    try {
      const base = new URL(location.href);
      base.searchParams.delete("visit");
      const url = houseLink(this.getHouse(), base);
      byId("share-url").value = url;
      const large = url.length > 6000;
      byId("download").classList.toggle("action", large);
      byId("copy-url").classList.toggle("action", !large);
      byId("share-message").textContent = large ? "This house makes a long link. Download the file to share it." : "";
      byId("share-dialog").showModal();
    } catch (error) { this.notify(error.message); }
  }

  async #copy() {
    const field = byId("share-url");
    try {
      await navigator.clipboard.writeText(field.value);
      byId("share-message").textContent = "Link copied.";
    } catch {
      field.focus();
      field.select();
      byId("share-message").textContent = "The link is selected. Use Copy on your device.";
    }
  }

  download() {
    const house = this.getHouse();
    const blob = new Blob([houseText(house)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = (house.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "house") + ".house.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}
