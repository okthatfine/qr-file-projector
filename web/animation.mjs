import QRCode from "qrcode";
import jsQR from "jsqr";
import {new_animation, append_qr, animation_bytes, read_animation} from "../_build/js/release/build/qr-file-projector.js";
import {Receiver} from "./receive.mjs";

export function encodeFilm(frames, dwell, progress = () => {}) {
  if (!frames.length || frames.length > 1024) throw Error("放映序列长度无效");
  const matrices = frames.map(frame => QRCode.create(frame, {errorCorrectionLevel: "M"}).modules);
  const side = (Math.max(...matrices.map(matrix => matrix.size)) + 8) * 3;
  const film = new_animation(side, Math.round(dwell / 10));
  for (const [i, matrix] of matrices.entries()) {
    const error = append_qr(film, matrix.data, matrix.size, 3);
    if (error) throw Error(error);
    progress(i + 1, frames.length);
  }
  return animation_bytes(film);
}

export function decodeFilm(bytes, checkpoint = "", progress = () => {}) {
  const receiver = new Receiver();
  if (checkpoint) receiver.restore(checkpoint);
  let frame = 0;
  const error = read_animation(bytes, (side, shades) => {
    const rgba = new Uint8ClampedArray(side * side * 4);
    for (let i = 0; i < shades.length; i++) {
      const color = shades[i] ? 0 : 255;
      rgba.fill(color, i * 4, i * 4 + 3);
      rgba[i * 4 + 3] = 255;
    }
    const qr = jsQR(rgba, side, side, {inversionAttempts: "dontInvert"});
    if (!qr) throw Error("第 " + (frame + 1) + " 帧无法识别二维码");
    receiver.accept(qr.data);
    progress(++frame);
  });
  if (error) throw Error(error);
  return receiver.snapshot();
}
