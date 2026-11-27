const keyType = "ssh-ed25519";
const certificateType = "ssh-ed25519-cert-v01@openssh.com";
const userdataExtension = "userdata@house-music";
const magic = "openssh-key-v1\0";
const armour = ["-----BEGIN OPENSSH PRIVATE KEY-----", "-----END OPENSSH PRIVATE KEY-----"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function join(...parts) {
  const all = parts.map(part => typeof part === "string" ? encoder.encode(part) : part);
  const bytes = new Uint8Array(all.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of all) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function uint64(value) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value));
  return bytes;
}

function string(...parts) {
  const value = join(...parts);
  return join(uint32(value.length), value);
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64url(bytes) {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64(text) {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0));
}

function reader(bytes) {
  let offset = 0;
  const take = length => {
    if (offset + length > bytes.length) throw Error("truncated");
    return bytes.subarray(offset, offset += length);
  };
  const number = () => new DataView(take(4).slice().buffer).getUint32(0);
  return { take, number, string: () => take(number()), text: () => decoder.decode(take(number())) };
}

const publicBlob = publicKey => join(string(keyType), string(publicKey));

export function publicKeyLine(key, comment) {
  return `${keyType} ${base64(publicBlob(key.publicKey))} ${comment}\n`;
}

export async function generateKey() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const { d, x } = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { seed: fromBase64(d), publicKey: fromBase64(x) };
}

export function writePrivateKey(key, comment) {
  const check = crypto.getRandomValues(new Uint8Array(4));
  const secret = join(check, check, string(keyType), string(key.publicKey), string(key.seed, key.publicKey), string(comment));
  const padding = Uint8Array.from({ length: (8 - secret.length % 8) % 8 }, (_, index) => index + 1);
  const file = join(magic, string("none"), string("none"), string(), uint32(1),
    string(publicBlob(key.publicKey)), string(secret, padding));
  return [armour[0], ...base64(file).match(/.{1,70}/g), armour[1], ""].join("\n");
}

export function readPrivateKey(text) {
  try {
    const body = text.replaceAll("\\n", "\n").split(armour[0])[1].split(armour[1])[0];
    const file = reader(fromBase64(body.replace(/\s+/g, "")));
    if (decoder.decode(file.take(magic.length)) !== magic || file.text() !== "none") throw Error("encrypted");
    file.string();
    file.string();
    if (file.number() !== 1) throw Error("several keys");
    file.string();
    const secret = reader(file.string());
    if (secret.number() !== secret.number() || secret.text() !== keyType) throw Error("not ed25519");
    const publicKey = secret.string().slice();
    return { seed: secret.string().slice(0, 32), publicKey };
  } catch {
    throw Error("Set BOARD_CA_KEY to the unencrypted ed25519 key that ssharg-cert ca writes to user_ca.");
  }
}

// Matches what the board's certs.verify accepts: a user certificate for one principal,
// no critical options, and userdata@house-music as its only extension.
export async function signCertificate({ authority, key, user, userdata, validAfter, validBefore }) {
  const signer = await crypto.subtle.importKey("jwk", {
    kty: "OKP", crv: "Ed25519", d: base64url(authority.seed), x: base64url(authority.publicKey),
  }, { name: "Ed25519" }, false, ["sign"]);
  const extension = join(string(userdataExtension), string(string(userdata)));
  const body = join(
    string(certificateType), string(crypto.getRandomValues(new Uint8Array(32))), string(key.publicKey),
    crypto.getRandomValues(new Uint8Array(8)), uint32(1), string(user), string(string(user)),
    uint64(validAfter), uint64(validBefore), string(), string(extension), string(),
    string(publicBlob(authority.publicKey)),
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer, body));
  const certificate = join(body, string(string(keyType), string(signature)));
  return `${certificateType} ${base64(certificate)} ${user}\n`;
}
