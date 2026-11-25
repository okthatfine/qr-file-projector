import jsQR from "jsqr";
import {Receiver} from "./receive.mjs";

export async function scan(video,show,save) {
  const stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
  const buffer = document.createElement("canvas");
  const ctx = buffer.getContext("2d",{willReadFrequently:true});
  const receiver = new Receiver();
  let stopped=false, timer;
  function stop() {
    stopped=true;
    clearTimeout(timer);
    for(const track of stream.getTracks()) track.stop();
    video.srcObject=null;
  }
  async function read() {
    if(stopped) return;
    if(video.readyState>=2 && video.videoWidth && video.videoHeight) {
      const scale=Math.min(1,1024/Math.max(video.videoWidth,video.videoHeight));
      buffer.width=Math.max(1,Math.round(video.videoWidth*scale));
      buffer.height=Math.max(1,Math.round(video.videoHeight*scale));
      ctx.drawImage(video,0,0,buffer.width,buffer.height);
      const pixels=ctx.getImageData(0,0,buffer.width,buffer.height);
      const qr=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:"dontInvert"});
      if(qr) {
        try {
          const {count,total,complete}=receiver.accept(qr.data);
          show(`已收 ${count} / ${total} 块`);
          if(complete) {
            const result=await receiver.finish();
            if(!stopped) { stop(); save(result); }
            return;
          }
        } catch(err) { show(err.message); }
      }
    }
    if(!stopped) timer=setTimeout(()=>read().catch(e=>{stop(); show(e.message);}),80);
  }
  try { video.srcObject=stream; await video.play(); await read(); }
  catch(err) { stop(); throw err; }
  return stop;
}
