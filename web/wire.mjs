import {read_wire, write_wire} from "../_build/js/release/build/qr-file-projector.js";
export const MAX_BYTES = 65536;

export async function fingerprint(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, n => n.toString(16).padStart(2, "0")).join("");
}

export function encodeBytes(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function decodeBytes(text) {
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}

export function writeFrame(meta, index, bytes) {
  return write_wire(meta.hash, meta.name, meta.length, meta.width, index, encodeBytes(bytes));
}

export function readFrame(text) {
  if (typeof text !== "string") throw Error("无法识别的帧");
  let frame;
  const error = read_wire(text, (hash, name, length, width, index, payload, total) => {
    frame = {hash, name, length, width, index, payload, total};
  });
  if (error) throw Error(error);
  return frame;
}
