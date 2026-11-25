import {chunk_count,chunk_start,chunk_end} from "../_build/js/release/build/qr-file-projector.js";
import {fingerprint,MAX_BYTES,writeFrame} from "./wire.mjs";

export async function prepare(file, width=256) {
  if (!Number.isInteger(width) || width < 64 || width > 512) throw Error("每块应为 64 至 512 字节");
  if (file.size > MAX_BYTES) throw Error("请选择不超过 64 KiB 的文件");
  if (!file.name || file.name.length > 96) throw Error("文件名须为 1 至 96 个字符");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = {name:file.name, length:bytes.length, width, hash:await fingerprint(bytes)};
  const total = chunk_count(bytes.length,width);
  return Array.from({length:total}, (_,i) => writeFrame(meta,i,
    bytes.subarray(chunk_start(bytes.length,width,i),chunk_end(bytes.length,width,i))));
}
