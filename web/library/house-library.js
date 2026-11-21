import { readHouse } from "./house-format.js";

const key = "house-music.library";

export class HouseLibrary {
  #storage;

  constructor(storage) {
    this.#storage = storage;
  }

  #read() {
    if (!this.#storage) throw Error("Device storage is unavailable. Download your house to keep a copy.");
    let text;
    try {
      text = this.#storage.getItem(key);
    } catch {
      throw Error("Device storage is unavailable. Download your house to keep a copy.");
    }
    if (text === null) return { activeId: null, houses: [] };

    try {
      const { activeId, houses } = JSON.parse(text);
      if (!Array.isArray(houses)) throw Error();
      const ids = new Set();
      const entries = houses.map(({ id, house }) => {
        if (typeof id !== "string" || !id.trim() || Object.hasOwn(Object.prototype, id) || ids.has(id)) throw Error();
        ids.add(id);
        return { id, house: readHouse(house) };
      });
      if (activeId !== null && !ids.has(activeId)) throw Error();
      return { activeId, houses: entries };
    } catch {
      throw Error("The saved house library could not be read. Download your current house to keep a copy.");
    }
  }

  #write(library) {
    try {
      this.#storage.setItem(key, JSON.stringify(library));
    } catch {
      throw Error("The house could not be saved on this device. Download your house to keep a copy.");
    }
  }

  list() {
    return this.#read().houses.map(({ id, house }) => ({ id, title: house.title }));
  }

  current() {
    const { activeId, houses } = this.#read();
    return houses.find(entry => entry.id === activeId) ?? null;
  }

  open(id) {
    const library = this.#read();
    const entry = library.houses.find(entry => entry.id === id);
    if (!entry) throw Error("This house is no longer in the saved library.");
    if (library.activeId !== id) {
      library.activeId = id;
      this.#write(library);
    }
    return entry;
  }

  save(id, house) {
    const library = this.#read();
    const snapshot = readHouse(house);
    if (id === null) {
      do {
        id = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
      } while (library.houses.some(entry => entry.id === id));
      library.houses.push({ id, house: snapshot });
    } else {
      const entry = library.houses.find(entry => entry.id === id);
      if (!entry) throw Error("This house is no longer in the saved library. Save a copy to keep your edits.");
      entry.house = snapshot;
    }
    library.activeId = id;
    this.#write(library);
    return id;
  }
}
