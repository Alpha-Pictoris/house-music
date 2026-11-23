const pages = [...document.querySelectorAll('a[href^="/"]:not([data-test-strip])')];
for (const link of document.querySelectorAll(".govuk-service-navigation__link")) {
  if (link.pathname === location.pathname) {
    link.setAttribute("aria-current", "page");
    link.closest("li").classList.add("govuk-service-navigation__item--active");
  }
}

function carryRecording() {
  const fragment = location.hash;
  const hasRecording = new URLSearchParams(fragment.slice(1)).has("h");
  for (const link of pages) {
    link.hash = hasRecording ? fragment : "";
  }
}

document.querySelector(".govuk-skip-link").addEventListener("click", event => {
  if (!new URLSearchParams(location.hash.slice(1)).has("h")) return;
  event.preventDefault();
  const main = document.getElementById("main");
  main.focus({ preventScroll: true });
  main.scrollIntoView();
});

window.addEventListener("hashchange", carryRecording);
window.addEventListener("pageshow", carryRecording);
carryRecording();
