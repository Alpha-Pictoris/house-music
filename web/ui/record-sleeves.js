import { arrangements } from "../music/arrangements.js";

const engravings = {
  chrome: '<ellipse cx="20" cy="20" rx="16" ry="6" transform="rotate(-34 20 20)"/><circle cx="20" cy="20" r="9"/><path d="m28 6 2-4 1 4 4 1-4 1-1 4-2-4-3-1z"/>',
  moth: '<path d="M20 18C14 9 6 8 3 9c1 8 4 17 13 16-6 3-5 6-4 8 4 1 6-2 8-7 2 5 5 8 8 7 1-3 1-6-4-8 9 1 12-8 13-16-8-1-13 4-17 9zm-3-5 3 5 3-5m-3 4v13"/><circle cx="10" cy="17" r="2"/><circle cx="30" cy="17" r="2"/>',
  floorboards: '<path d="m2 23 12-10 23 3-12 10zm1 2 20 5 14-11m-34 9 19 6 15-11M13 14l9 3-6 2 8 4m-1-12 3-6m3 9 6-3"/>',
  cassette: '<path d="m4 9 29-2 3 22-29 3zm5 6 19-2 1 8-19 2zm3 14 2-5 11-1 4 5"/><circle cx="14" cy="18" r="2.5"/><circle cx="25" cy="17" r="2.5"/><path d="m17 19 5-1"/>',
  landing: '<path d="m5 18 20-2 9-8 2 16-10-4-18 3zm8 4 1 5c1 7 13 6 12-1l-1-6M13 13l1 4m4-5 1 4m4-5 1 4m-13-2 5-1m0-1 5-1m0-1 5-1"/>'
};

export function recordSleeves() {
  return Object.entries(arrangements).map(([id, { label, bpm }]) =>
    '<button data-mode="' + id + '" aria-pressed="false"><span class="sleeve"><svg viewBox="0 0 40 40" aria-hidden="true">' +
    engravings[id] + '</svg></span><strong>' + label + '</strong><small>' + bpm + ' BPM</small></button>'
  ).join("");
}

export class RecordCrate {
  constructor(root, choose) {
    this.root = root;
    if (!root.childElementCount) root.innerHTML = recordSleeves();
    for (const button of root.children) button.onclick = () => choose(button.dataset.mode);
  }

  show(mode) {
    for (const button of this.root.children) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }
}
