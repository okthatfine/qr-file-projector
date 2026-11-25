import {build} from "esbuild";
import {mkdir,copyFile} from "node:fs/promises";

await mkdir("dist",{recursive:true});
await build({
  entryPoints:["web/app.mjs"],outfile:"dist/app.js",bundle:true,
  platform:"browser",target:"es2020",format:"esm",legalComments:"eof"
});
await copyFile("web/index.html","dist/index.html");
console.log("Built dist/index.html and local app.js; no CDN is needed.");
