import QRCode from "qrcode";
import {prepare} from "./send.mjs";

export async function project(file, width, canvas, dwell, show, ranges = "") {
  const frames = await prepare(file,width,ranges);
  const image = document.createElement("canvas");
  let index = 0, timer, stopped = false;
  const paint = async () => {
    await QRCode.toCanvas(image,frames[index],{width:720,margin:4,errorCorrectionLevel:"M"});
    if (stopped) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image,0,0);
    show(`第 ${index+1} / ${frames.length} 帧 · ${file.name}`);
    index = (index+1) % frames.length;
    timer = setTimeout(()=>paint().catch(e=>show(e.message)),dwell);
  };
  await paint();
  return () => { stopped=true; clearTimeout(timer); };
}
