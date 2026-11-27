// The number inked on a deposited cassette. The same saved house gets the same number on any device.
export function recordingNumber(house) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(JSON.stringify(house))) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  const digits = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return "041a / " + digits.slice(0, 4) + "-" + digits.slice(4);
}
