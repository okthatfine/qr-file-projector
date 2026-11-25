import test from "node:test";
import assert from "node:assert/strict";
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
