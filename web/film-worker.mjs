import {encodeFilm, decodeFilm} from "./animation.mjs";
import {prepare} from "./send.mjs";

self.onmessage = async ({data}) => {
  try {
    const progress = (current, total) => self.postMessage({current, total});
    if (data.action === "encode") {
      const frames = await prepare(data.file, data.width, data.ranges);
      const bytes = encodeFilm(frames, data.dwell, progress);
      self.postMessage({bytes}, [bytes.buffer]);
    } else {
      const bytes = new Uint8Array(await data.file.arrayBuffer());
      self.postMessage({checkpoint: decodeFilm(bytes, data.checkpoint, progress)});
    }
  } catch (error) {
    self.postMessage({error: error.message});
  }
};
