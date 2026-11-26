import {project_frames} from "../_build/js/release/build/qr-file-projector.js";
import {fingerprint, MAX_BYTES} from "./wire.mjs";

export async function prepare(file, width = 256, ranges = "") {
  if (!Number.isInteger(width)) throw Error("块宽须为整数");
  if (file.size > MAX_BYTES) throw Error("请选择不超过 64 KiB 的文件");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const frames = [];
  const error = project_frames(bytes, file.name, await fingerprint(bytes), width, ranges, frame => frames.push(frame));
  if (error) throw Error(error);
  return frames;
}
