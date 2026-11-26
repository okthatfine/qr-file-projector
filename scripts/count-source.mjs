import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z", "--", "*.mbt"], {encoding: "utf8"});
let total = 0;
for (const path of tracked.split("\0").filter(Boolean)) {
  if (/(?:^|\/)(?:_build|target|vendor|node_modules)\/|_(?:wb)?test\.mbt$|\.generated\.mbt$/.test(path)) continue;
  const source = readFileSync(path, "utf8");
  if (/^test\s+"/m.test(source)) throw Error("测试应放在独立测试文件中：" + path);
  const count = source.split(/\r?\n/).filter(line => /[\p{L}\d_]/u.test(line.split("//", 1)[0])).length;
  console.log(String(count).padStart(4), path);
  total += count;
}
console.log("有效生产源码行数合计", total);
if (total < 500) process.exitCode = 1;
