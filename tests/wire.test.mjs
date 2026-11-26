import test from "node:test";
import assert from "node:assert/strict";
import {readFrame,writeFrame,fingerprint} from "../web/wire.mjs";
test("binary and Unicode names round trip; reject malformed lengths", async () => {
  const bytes = Uint8Array.of(0, 255);
  const m = {name:"课程.mbt",width:64,length:2,hash:await fingerprint(bytes)};
  assert.equal(readFrame(writeFrame(m,0,bytes)).payload,"AP8=");
  assert.throws(()=>readFrame(writeFrame(m,1,bytes)));
  assert.throws(()=>readFrame(writeFrame({...m,length:3},0,bytes)));
});

test("read frames from the original browser encoder and reject malformed variants", () => {
  const hash = "af".repeat(32);
  const original = ["QFP1", hash, "课件😀.txt", 2, 64, 0, "AP8="];
  const frame = readFrame(JSON.stringify(original));
  assert.deepEqual(frame, {
    hash, name: "课件😀.txt", length: 2, width: 64, index: 0, payload: "AP8=", total: 1,
  });
  assert.deepEqual(JSON.parse(writeFrame(frame, 0, Uint8Array.of(0, 255))), original);
  for (const [field, value] of [
    [0, "QFP2"], [1, hash.toUpperCase()], [2, "😀".repeat(49)],
    [3, 2.5], [4, 63], [5, 4294967296], [6, "AP9="], [6, "AP8"],
  ]) {
    const malformed = original.slice();
    malformed[field] = value;
    assert.throws(() => readFrame(JSON.stringify(malformed)));
  }
  assert.throws(() => readFrame(JSON.stringify([...original, null])));
});
