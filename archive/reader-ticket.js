import { houseFromLink } from "./house/library/house-format.js";
import { recordingNumber } from "./recording-number.js";

const sleeve = document.querySelector("[data-ticket]");
const form = sleeve.querySelector("form");
const status = sleeve.querySelector("[data-ticket-status]");
const button = form.querySelector("button");

// The ticket names the cassette the reader is carrying. The house itself stays in the browser.
function nameHolder() {
  let house;
  try { house = houseFromLink(location.href); } catch { house = null; }
  form.elements.recording.value = house ? recordingNumber(house) : "";
  form.elements.title.value = house?.title ?? "";
}

sleeve.addEventListener("toggle", async () => {
  if (!sleeve.open) return;
  const desk = await fetch(form.action).then(response => response.json()).catch(() => ({}));
  form.hidden = !desk.available;
  status.textContent = desk.available ? "" : "The ticket is not available at present.";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (button.disabled) return;
  nameHolder();
  button.disabled = true;
  status.textContent = "";
  try {
    const response = await fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)) });
    if (response.ok) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = "readers-ticket.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60e3);
      status.textContent = "Ticket taken. Unzip it and read readers-ticket.txt first.";
    } else {
      status.textContent = (await response.json()).message;
    }
  } catch {
    status.textContent = "We could not reach the archive. Check your connection and try again.";
  } finally {
    button.disabled = false;
  }
});
