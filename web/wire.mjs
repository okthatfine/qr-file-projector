const marker = "QFP1";
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
  return JSON.stringify([marker, meta.hash, meta.name, meta.length, meta.width, index, encodeBytes(bytes)]);
}

export function readFrame(text) {
  if (typeof text !== "string" || text.length > 1600) throw Error("无法识别的帧");
  const row = JSON.parse(text);
  if (!Array.isArray(row) || row.length !== 7 || row[0] !== marker) throw Error("未知帧格式");
  const [,hash,name,length,width,index,payload] = row;
  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash) ||
      typeof name !== "string" || !name.length || name.length > 96 ||
      !Number.isInteger(length) || length < 0 || length > MAX_BYTES ||
      !Number.isInteger(width) || width < 64 || width > 512) throw Error("无效文件描述");
  const total = Math.max(1, Math.ceil(length / width));
  if (!Number.isInteger(index) || index < 0 || index >= total || typeof payload !== "string") throw Error("无效块号");
  const raw = decodeBytes(payload);
  if (raw.length !== Math.min(width, length - index * width) || encodeBytes(raw) !== payload) throw Error("无效数据块");
  return {hash,name,length,width,index,payload,total};
}
