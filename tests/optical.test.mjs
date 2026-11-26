import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {prepare} from "../web/send.mjs";
import {Receiver} from "../web/receive.mjs";

function capture(text) {
  const {modules}=QRCode.create(text,{errorCorrectionLevel:"M"});
  const scale=5, quiet=4;
  const side=(modules.size+quiet*2)*scale;
  const image=new Uint8ClampedArray(side*side*4).fill(255);
  for(let y=0;y<side;y++) for(let x=0;x<side;x++) {
    const row=Math.floor(y/scale)-quiet, col=Math.floor(x/scale)-quiet;
    if(row<0 || col<0 || row>=modules.size || col>=modules.size || !modules.get(row,col)) continue;
    const at=(y*side+x)*4;
    image[at]=image[at+1]=image[at+2]=0;
  }
  const observed=jsQR(image,side,side);
  assert.ok(observed,"frame should be recoverable from its rendered pixels");
  return observed.data;
}
test("decode QR pixels after joining halfway through a broadcast",async ()=>{
  const bytes=Uint8Array.from({length:701},(_,i)=>(i*17)%256);
  const frames=await prepare(new File([bytes],"数据.csv"),256);
  const receiver=new Receiver();
  for (const i of [2,0,2,1]) receiver.accept(capture(frames[i]));
  assert.deepEqual((await receiver.finish()).bytes,bytes);
});

test("recover a 12 KiB projection after a six-frame blackout", async (t) => {
  const original = Uint8Array.from({length: 12 * 1024}, (_, i) => i % 251);
  const frames = await prepare(new File([original], "classroom.bin"), 512);
  assert.equal(frames.length, 24);

  const receiver = new Receiver();
  const visible = new Uint8ClampedArray(320 * 320 * 4).fill(255);
  assert.equal(jsQR(visible, 320, 320), null);

  // The lens is covered while frames 1–6 are on screen.
  for (const frame of frames.slice(6)) receiver.accept(capture(frame));
  assert.equal(receiver.count, 18);
  await assert.rejects(receiver.finish(), /还有数据块/);
  t.diagnostic("第一轮收到 18/24 帧，尚缺 6 帧");

  // The projector loops, so the receiver sees the six missed frames next.
  for (const frame of frames.slice(0, 6)) receiver.accept(capture(frame));
  const recovered = await receiver.finish();
  assert.equal(receiver.count, 24);
  assert.equal(recovered.name, "classroom.bin");
  assert.deepEqual(recovered.bytes, original);
  const digest = createHash("sha256").update(recovered.bytes).digest("hex");
  t.diagnostic(`第二轮收到 24/24 帧，还原 ${recovered.bytes.length} 字节，SHA-256 ${digest}`);
});
