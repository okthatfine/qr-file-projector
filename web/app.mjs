import {project} from "./project.mjs";
import {scan} from "./camera.mjs";
import {Receiver} from "./receive.mjs";

const el = id => document.getElementById(id);
let receiver = new Receiver();
let stopProject, stopCamera, worker, resultUrl;
let cameraActive = false;

function message(id, text) {
  el(id).textContent = text;
}
function clearResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = undefined;
  el("save").hidden = true;
  el("save").removeAttribute("href");
}
function refresh() {
  const busy = Boolean(worker) || cameraActive;
  for (const id of ["importGif", "resume"]) el(id).disabled = busy;
  el("reset").disabled = busy || !receiver.count;
  el("checkpoint").disabled = !receiver.count;
  el("export").disabled = Boolean(worker);
  el("camera").disabled = busy || receiver.complete;
  el("cancel").disabled = !stopCamera;
  el("repairBox").hidden = !receiver.ticket;
  el("ticket").value = receiver.ticket;
  message("missing", receiver.ticket ? "缺少第 " + receiver.missing + " 帧。把补播凭条交给放映者即可。" : "");
}
function report() {
  message("progress", "已收 " + receiver.count + " / " + receiver.total + " 块");
  refresh();
}
function offerFile({bytes, name}) {
  clearResult();
  resultUrl = URL.createObjectURL(new Blob([bytes]));
  const link = el("save");
  link.href = resultUrl;
  link.download = name;
  link.textContent = "保存 " + name;
  link.hidden = false;
  message("progress", "已收齐，文件摘要校验通过");
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function settings() {
  const file = el("file").files[0];
  if (!file) throw Error("请先选择文件");
  return {file, width: Number(el("width").value), dwell: Number(el("dwell").value), ranges: el("ranges").value};
}

el("play").onclick = async () => {
  el("play").disabled = true;
  try {
    const {file, width, dwell, ranges} = settings();
    stopProject = await project(file, width, el("screen"), dwell, text => message("playing", text), ranges);
    el("pause").disabled = false;
  } catch (error) {
    message("playing", error.message);
    el("play").disabled = false;
  }
};
el("pause").onclick = () => {
  stopProject?.();
  el("screen").width = 1;
  message("playing", "已停止放映");
  el("play").disabled = false;
  el("pause").disabled = true;
};

el("camera").onclick = async () => {
  cameraActive = true;
  refresh();
  message("progress", "正在打开摄像头…");
  try {
    const stop = await scan(el("view"), text => { message("progress", text); refresh(); }, result => {
      cameraActive = false;
      stopCamera = undefined;
      offerFile(result);
      refresh();
    }, receiver);
    if (cameraActive) stopCamera = stop;
  } catch (error) {
    cameraActive = false;
    message("progress", error.message);
  }
  refresh();
};
el("cancel").onclick = () => {
  stopCamera?.();
  stopCamera = undefined;
  cameraActive = false;
  message("progress", "已停止取景，已收数据可继续使用");
  refresh();
};
el("reset").onclick = () => {
  receiver = new Receiver();
  clearResult();
  message("progress", "已清空接收进度");
  refresh();
};
el("ticket").onclick = event => event.target.select();
el("checkpoint").onclick = () => download(new Blob([receiver.snapshot()]), "放映进度.qfc");
el("resume").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 250000) throw Error("进度文件过大");
    const candidate = new Receiver();
    if (receiver.count) candidate.restore(receiver.snapshot());
    candidate.merge(await file.text());
    const complete = candidate.complete ? await candidate.finish() : null;
    receiver = candidate;
    clearResult();
    report();
    if (complete) offerFile(complete);
  } catch (error) { message("progress", error.message); }
};

function runWorker(data, onProgress) {
  worker = new Worker("./film-worker.js", {type: "module"});
  refresh();
  return new Promise((resolve, reject) => {
    worker.onerror = event => reject(Error(event.message || "放映文件处理失败"));
    worker.onmessage = ({data: result}) => {
      if (result.error) reject(Error(result.error));
      else if (result.current) onProgress(result);
      else resolve(result);
    };
    worker.postMessage(data);
  }).finally(() => {
    worker.terminate();
    worker = undefined;
    refresh();
  });
}
el("export").onclick = async () => {
  try {
    const options = settings();
    const result = await runWorker({action: "encode", ...options}, ({current, total}) =>
      message("playing", "正在导出第 " + current + " / " + total + " 帧"));
    download(new Blob([result.bytes], {type: "image/gif"}), options.file.name + ".gif");
    message("playing", "已生成循环 GIF");
  } catch (error) { message("playing", error.message); }
};
el("importGif").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 32 * 1024 * 1024) throw Error("GIF 超过 32 MiB");
    const result = await runWorker({action: "decode", file, checkpoint: receiver.snapshot()}, ({current}) =>
      message("progress", "已解码 GIF 第 " + current + " 帧"));
    const candidate = new Receiver();
    candidate.restore(result.checkpoint);
    const complete = candidate.complete ? await candidate.finish() : null;
    receiver = candidate;
    clearResult();
    report();
    if (complete) offerFile(complete);
  } catch (error) { message("progress", error.message); }
};
window.addEventListener("pagehide", () => { stopCamera?.(); stopProject?.(); worker?.terminate(); });
refresh();
