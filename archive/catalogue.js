const form = document.querySelector("[data-search]");
const query = form.elements.q;
const records = [...document.querySelectorAll("[data-record]")];
records.sort((left, right) => left.dataset.title.localeCompare(right.dataset.title, "en-GB"));
document.querySelector("[data-record-list]").append(...records);
const count = document.querySelector("[data-count]");
const empty = document.querySelector("[data-empty]");

function normaliseReference(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function showRecords() {
  const url = new URL(location.href);
  query.value = url.searchParams.get("q") ?? "";
  const terms = query.value.toLowerCase().trim().split(/\s+/);
  for (const record of records) {
    const text = (record.dataset.record + " " + record.textContent).toLowerCase();
    if (record.hasAttribute("data-reference-only")) {
      record.hidden = normaliseReference(query.value) !== normaliseReference(record.dataset.record);
    } else {
      record.hidden = !terms.every(term => text.includes(term));
    }
  }
  const matches = records.filter(record => !record.hidden).length;
  count.textContent = matches === 1 ? "1 record" : matches + " records";
  empty.hidden = matches > 0;
}

form.hidden = false;
form.addEventListener("submit", event => {
  event.preventDefault();
  const url = new URL(location.href);
  const term = query.value.trim();
  if (term) url.searchParams.set("q", term);
  else url.searchParams.delete("q");
  history.pushState(null, "", url);
  showRecords();
  document.querySelector("#catalogue").scrollIntoView();
});
window.addEventListener("popstate", showRecords);
showRecords();
