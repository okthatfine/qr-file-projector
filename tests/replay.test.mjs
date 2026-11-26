import test from "node:test";
import assert from "node:assert/strict";
import {prepare} from "../web/send.mjs";
import {Receiver} from "../web/receive.mjs";
import {encodeFilm, decodeFilm} from "../web/animation.mjs";

const sample = Uint8Array.from({length: 1027}, (_, i) => i % 239);
const source = new File([sample], "手册.txt");

test("restore a checkpoint and recover precisely the requested frames from a looping GIF", async () => {
  const frames = await prepare(source, 256);
  const before = new Receiver();
  for (const i of [1, 4, 4]) before.accept(frames[i]);
  assert.equal(before.missing, "1,3-4");
  const resumed = new Receiver();
  resumed.restore(before.snapshot());
  assert.equal(resumed.count, 2);
  const repair = await prepare(source, 256, resumed.ticket);
  assert.deepEqual(repair, [frames[0], frames[2], frames[3]]);
  const gif = encodeFilm(repair, 700);
  assert.equal(new TextDecoder().decode(gif.slice(0, 6)), "GIF89a");
  resumed.restore(decodeFilm(gif, resumed.snapshot()));
  assert.equal(resumed.missing, "");
  assert.deepEqual((await resumed.finish()).bytes, sample);
});

test("invalid routes or damaged imports leave the existing transfer intact", async () => {
  const frames = await prepare(source, 128);
  const receiver = new Receiver();
  receiver.accept(frames[0]);
  const saved = receiver.snapshot();
  const bad = JSON.parse(saved);
  bad.at(-1).push(bad.at(-1)[0]);
  assert.throws(() => receiver.restore(JSON.stringify(bad)));
  assert.equal(receiver.snapshot(), saved);
  await assert.rejects(prepare(source, 256, receiver.ticket), /块/);
  await assert.rejects(prepare(new File(["different"], source.name), 128, receiver.ticket), /另一份/);
  for (const request of ["1,0", "2-1", "9999999999999", "1,,3", "QFR1:bad"]) {
    await assert.rejects(prepare(source, 128, request));
  }
  assert.deepEqual(await prepare(source, 128, "2,1-2"), frames.slice(0, 2));
  const good = encodeFilm([frames[0]], 1100);
  assert.throws(() => decodeFilm(good.slice(0,-1)), /截断/);
});

test("full-size transfers and zero-length files survive saved progress", async () => {
  for (const length of [0, 65536]) {
    const original = Uint8Array.from({length}, (_, i) => (3*i) % 251);
    const frames = await prepare(new File([original], "边界.bin"), 64);
    const captured = new Receiver();
    for (const frame of frames.reverse()) captured.accept(frame);
    const resumed = new Receiver();
    resumed.restore(captured.snapshot());
    assert.deepEqual((await resumed.finish()).bytes, original);
  }
});

test("two partial checkpoints merge without overwriting conflicting progress", async () => {
  const frames = await prepare(source, 256);
  const a = new Receiver(), b = new Receiver();
  for (const i of [0, 3]) a.accept(frames[i]);
  for (const i of [1, 2, 3, 4]) b.accept(frames[i]);
  const edited = JSON.parse(b.snapshot());
  const overlap = edited.at(-1).find(([i]) => i === 3);
  overlap[1] = Buffer.alloc(256, 255).toString("base64");
  const original = a.snapshot();
  assert.throws(() => a.merge(JSON.stringify(edited)), /冲突/);
  assert.equal(a.snapshot(), original);
  a.merge(b.snapshot());
  a.merge(b.snapshot());
  assert.deepEqual((await a.finish()).bytes, sample);
});
