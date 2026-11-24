const strip = document.querySelector("[data-test-strip]");
if (strip?.getAttribute("href").startsWith("/assets/")) {
  if (location.port === "4174") {
    const game = new URL("/", location.href);
    game.port = "5173";
    game.hash = strip.hash;
    strip.href = game.href;
  } else {
    strip.download = "stairwell-test.house.json";
  }
}
