import {new_collector, receive_frame, frame_at} from "../_build/js/release/build/qr-file-projector.js";
import {readFrame,decodeBytes,fingerprint} from "./wire.mjs";

export class Receiver {
  accept(text) {
    const f = readFrame(text);
    const key = JSON.stringify([f.hash,f.name,f.length,f.width]);
    if (this.key && key !== this.key) throw Error("发现另一份文件，请先重置接收");
    if (!this.key) {
      this.key = key;
      this.meta = f;
      this.slots = new_collector(f.total);
    }
    const count = receive_frame(this.slots,f.index,f.payload);
    if (count < 0) throw Error("同一块号的数据冲突，请重新接收");
    this.count = count;
    return {count,total:f.total,complete:count === f.total};
  }
  async finish() {
    const m = this.meta;
    if (!m || this.count !== m.total) throw Error("还有数据块待接收");
    const bytes = new Uint8Array(m.length);
    for (let i=0;i<m.total;i++) bytes.set(decodeBytes(frame_at(this.slots,i)), i*m.width);
    if (await fingerprint(bytes) !== m.hash) throw Error("文件摘要不符，请重新接收");
    return {bytes,name:m.name};
  }
}
