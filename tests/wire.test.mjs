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
