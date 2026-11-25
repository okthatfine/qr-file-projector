import {project} from "./project.mjs";
import {scan} from "./camera.mjs";
const el = id => document.getElementById(id);
let stopProject, stopCamera, downloadUrl;

el("play").onclick = async () => {
  const file = el("file").files[0];
  if(!file) { el("playing").textContent="请先选择文件"; return; }
  el("play").disabled=true;
  try {
    stopProject=await project(file,Number(el("width").value),el("screen"),Number(el("dwell").value),msg=>el("playing").textContent=msg);
    el("pause").disabled=false;
  } catch(err) { el("playing").textContent=err.message; el("play").disabled=false; }
};
el("pause").onclick = () => {
  stopProject?.(); el("screen").width=1; el("playing").textContent="已停止放映";
  el("play").disabled=false; el("pause").disabled=true;
};
el("camera").onclick = async () => {
  el("camera").disabled=true; el("progress").textContent="正在打开摄像头…";
  el("save").hidden=true;
  if(downloadUrl) URL.revokeObjectURL(downloadUrl);
  let finished=false;
  try {
    if(!navigator.mediaDevices?.getUserMedia) throw Error("请在 HTTPS 或 localhost 页面打开摄像头");
    stopCamera=await scan(el("view"),msg=>el("progress").textContent=msg,({bytes,name})=>{
      finished=true; downloadUrl=URL.createObjectURL(new Blob([bytes]));
      const link=el("save"); link.href=downloadUrl; link.download=name; link.hidden=false;
      link.textContent="保存 "+name; el("progress").textContent="已收齐，摘要校验通过";
      el("camera").disabled=false; el("cancel").disabled=true;
    });
    if(!finished) el("cancel").disabled=false;
  } catch(err) { el("progress").textContent=err.message; el("camera").disabled=false; }
};
el("cancel").onclick = () => {
  stopCamera?.(); el("cancel").disabled=true; el("camera").disabled=false;
  el("progress").textContent="已停止，可重新接收";
};
window.addEventListener("pagehide",()=>{stopCamera?.(); stopProject?.();});
