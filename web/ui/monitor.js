import { houseLink } from "../library/house-format.js";
import { byId } from "./elements.js";

function recordOffice() {
  const local = new URL("/", location.href);
  if (local.port === "5173") {
    local.port = "4174";
    return local.href;
  }
  return document.querySelector('meta[name="record-office"]').content;
}

export class Monitor {
  #dialog = byId("monitor-dialog");

  constructor() {
    byId("close-monitor").onclick = () => this.#dialog.close();
    this.#dialog.addEventListener("click", event => {
      if (event.target !== this.#dialog) return;
      const box = this.#dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.#dialog.close();
    });
  }

  open(house) {
    byId("monitor-link").href = houseLink(house, recordOffice());
    this.#dialog.showModal();
  }
}
