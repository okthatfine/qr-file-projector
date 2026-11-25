import test from "node:test";
import assert from "node:assert/strict";
import {prepare} from "../web/send.mjs";
import {Receiver} from "../web/receive.mjs";

test("recover six missed frames on a later loop and reject version mixing", async () => {
  const bytes = Uint8Array.from({length:12288},(_,i)=>i%251);
  const frames = await prepare(new File([bytes],"例程.mbt"),512);
  const r = new Receiver();
  for(const frame of frames.slice(6).reverse()) r.accept(frame);
  assert.equal(r.count,18);
  await assert.rejects(r.finish());
  const alt = await prepare(new File(["revised"],"例程.mbt"),512);
  assert.throws(()=>r.accept(alt[0]));
  for(const frame of frames) r.accept(frame);
  assert.deepEqual((await r.finish()).bytes,bytes);
});

test("reject a damaged completed file; round-trip an empty file", async () => {
  const [valid] = await prepare(new File(["hi"],"hi.txt"));
  const corrupted = JSON.parse(valid);
  corrupted[6] = btoa("no");
  const r = new Receiver();
  r.accept(JSON.stringify(corrupted));
  await assert.rejects(r.finish(),/摘要/);
  const empty = new Receiver();
  empty.accept((await prepare(new File([],"empty")))[0]);
  assert.equal((await empty.finish()).bytes.length,0);
});
