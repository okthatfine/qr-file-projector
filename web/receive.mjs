import {
  new_transfer, scan_frame, scan_count, scan_total, scan_hash, scan_name,
  missing_ranges, make_ticket, assembled_bytes, save_checkpoint, load_checkpoint, merge_checkpoint
} from "../_build/js/release/build/qr-file-projector.js";
import {fingerprint} from "./wire.mjs";

export class Receiver {
  session = new_transfer();
  get count() { return scan_count(this.session); }
  get total() { return scan_total(this.session); }
  get complete() { return this.total > 0 && this.count === this.total; }
  get missing() { return missing_ranges(this.session); }
  get ticket() { return make_ticket(this.session); }
  snapshot() { return save_checkpoint(this.session); }

  restore(text) {
    const error = load_checkpoint(this.session, text);
    if (error) throw Error(error);
  }

  merge(text) {
    const error = merge_checkpoint(this.session, text);
    if (error) throw Error(error);
  }

  accept(text) {
    if (typeof text !== "string") throw Error("无法识别的帧");
    const error = scan_frame(this.session, text);
    if (error) throw Error(error);
    return {count: this.count, total: this.total, complete: this.complete};
  }

  async finish() {
    if (!this.complete) throw Error("还有数据块待接收");
    const bytes = assembled_bytes(this.session);
    if (await fingerprint(bytes) !== scan_hash(this.session)) throw Error("文件摘要不符，请重新接收");
    return {bytes, name: scan_name(this.session)};
  }
}
