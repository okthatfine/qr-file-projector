import {build} from "esbuild";
import {mkdir,copyFile} from "node:fs/promises";

await mkdir("dist",{recursive:true});
await build({
  entryPoints:["web/app.mjs","web/film-worker.mjs"],outdir:"dist",bundle:true,
  platform:"browser",target:"es2020",format:"esm",legalComments:"eof"
});
await copyFile("web/index.html","dist/index.html");
console.log("Built the projector and offline GIF worker in dist/.");
