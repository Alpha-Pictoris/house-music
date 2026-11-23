import { referencePath } from "./file-references.js";

const form = document.querySelector("[data-search]");
const query = form.elements.q;
const records = [...document.querySelectorAll("[data-record]")];
const count = document.querySelector("[data-count]");
const empty = document.querySelector("[data-empty]");
let request;

function showRecords() {
  const url = new URL(location.href);
  query.value = url.searchParams.get("q") ?? "";
  const terms = query.value.toLowerCase().trim().split(/\s+/);
  for (const record of records) {
    const text = (record.dataset.record + " " + record.textContent).toLowerCase();
    record.hidden = !terms.every(term => text.includes(term));
  }
  const matches = records.filter(record => !record.hidden).length;
  count.textContent = matches === 1 ? "1 record" : matches + " records";
  empty.hidden = matches > 0;
}

form.hidden = false;
form.addEventListener("submit", async event => {
  event.preventDefault();
  request?.abort();
  const url = new URL(location.href);
  const term = query.value.trim();
  const path = referencePath(term);
  if (path) {
    request = new AbortController();
    const { signal } = request;
    const response = await fetch(path, { method: "HEAD", signal }).catch(() => null);
    if (signal.aborted) return;
    if (response?.ok) {
      url.pathname = path;
      url.search = "";
      location.assign(url);
      return;
    }
  }
  if (term) url.searchParams.set("q", term);
  else url.searchParams.delete("q");
  history.pushState(null, "", url);
  showRecords();
  document.querySelector("#catalogue").scrollIntoView();
});
query.addEventListener("input", () => request?.abort());
window.addEventListener("popstate", () => {
  request?.abort();
  showRecords();
});
window.addEventListener("pagehide", () => request?.abort());
showRecords();
