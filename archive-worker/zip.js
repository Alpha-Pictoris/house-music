const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ crc >>> 8;
  return (crc ^ 0xffffffff) >>> 0;
}

function record(...fields) {
  const bytes = new Uint8Array(fields.reduce((length, [size]) => length + size, 0));
  const view = new DataView(bytes.buffer);
  let offset = 0;
  for (const [size, value] of fields) {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    offset += size;
  }
  return bytes;
}

// Stores the files uncompressed. Each file carries its Unix mode so unzip keeps a private key private.
export function zip(files, modified) {
  const date = new Date(modified);
  const time = date.getUTCHours() << 11 | date.getUTCMinutes() << 5 | date.getUTCSeconds() >> 1;
  const day = Math.max(0, date.getUTCFullYear() - 1980) << 9 | date.getUTCMonth() + 1 << 5 | date.getUTCDate();
  const parts = [], directory = [];
  let offset = 0;
  for (const { name, text, mode } of files) {
    const path = encoder.encode(name), content = encoder.encode(text);
    const entry = [[2, 20], [2, 0x0800], [2, 0], [2, time], [2, day], [4, crc32(content)],
      [4, content.length], [4, content.length], [2, path.length], [2, 0]];
    parts.push(record([4, 0x04034b50], ...entry), path, content);
    directory.push(record([4, 0x02014b50], [2, 0x031e], ...entry, [2, 0], [2, 0], [2, 0],
      [4, (0o100000 | mode) << 16 >>> 0], [4, offset]), path);
    offset += 30 + path.length + content.length;
  }
  const size = directory.reduce((length, part) => length + part.length, 0);
  parts.push(...directory, record([4, 0x06054b50], [2, 0], [2, 0], [2, files.length], [2, files.length],
    [4, size], [4, offset], [2, 0]));
  const archive = new Uint8Array(offset + size + 22);
  let position = 0;
  for (const part of parts) {
    archive.set(part, position);
    position += part.length;
  }
  return archive;
}
