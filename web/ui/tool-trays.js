import { byId } from "./elements.js";

export class ToolTrays {
  active = null;
  #opener = null;
  #trays = document.querySelectorAll(".workbench .tray");

  constructor(controls) {
    this.controls = controls;
    for (const button of document.querySelectorAll("[data-tray]")) {
      button.onclick = () => {
        const name = button.dataset.tray;
        if (name === this.active) { this.close(); return; }
        if (name === "build") controls.use("room");
        if (name === "furnish") controls.select(null);
        this.open(name, button);
      };
    }
    for (const button of document.querySelectorAll("[data-tool]")) {
      button.onclick = () => {
        if (button.dataset.tool === "select") controls.select(null);
        else controls.use(button.dataset.tool);
        this.close();
        controls.canvas.focus({ preventScroll: true });
      };
    }
    byId("close-detail").onclick = () => this.dismiss();
    controls.canvas.addEventListener("pointerdown", () => this.close(), { capture: true });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !this.active || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      this.dismiss();
    }, { capture: true });
  }

  open(name, opener) {
    this.active = name;
    this.#opener = opener;
    this.refresh();
    byId(name + "-tray").querySelector("button:not(:disabled), input")?.focus({ preventScroll: true });
  }

  close() {
    if (!this.active) return;
    this.active = null;
    this.refresh();
  }

  dismiss() {
    this.close();
    const target = this.#opener?.offsetWidth ? this.#opener : this.controls.canvas;
    target.focus({ preventScroll: true });
  }

  refresh() {
    const tool = this.controls.tool;
    for (const tray of this.#trays) tray.hidden = tray.id !== this.active + "-tray";
    for (const button of document.querySelectorAll("[data-tray]")) {
      const name = button.dataset.tray, open = name === this.active;
      button.setAttribute("aria-expanded", String(open));
      button.classList.toggle("chosen", open || (!this.active && (
        (name === "build" && ["room", "door"].includes(tool)) ||
        (name === "furnish" && tool === "place") ||
        (name === "camera" && ["pan", "orbit"].includes(tool))
      )));
    }
    for (const button of document.querySelectorAll("[data-tool]")) {
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool && (!this.active || !button.closest(".toolbelt"))));
      if (button.dataset.tool === "door") button.disabled = !this.controls.editor.house.rooms.length;
    }
  }
}
