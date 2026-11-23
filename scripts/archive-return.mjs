import { readFileSync } from "node:fs";
import { houseLink } from "../web/library/house-format.js";

const attachment = "/assets/stairwell-test.house.json";
const file = new URL("../archive" + attachment, import.meta.url);
const strip = JSON.parse(readFileSync(file, "utf8"));

export function testStripURL(gameURL = process.env.HOUSE_MUSIC_URL) {
  if (!gameURL) return attachment + new URL(houseLink(strip, file)).hash;
  const destination = URL.canParse(gameURL) && new URL(gameURL);
  if (!destination || !["https:", "http:"].includes(destination.protocol) || destination.username || destination.password
      || destination.search || destination.hash) {
    throw Error("Set HOUSE_MUSIC_URL to the web address where the game opens.");
  }
  return houseLink(strip, destination);
}
