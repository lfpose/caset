// Compare a trace against test/baseline.json on behaviour only (not visual copy or layout).
// Exit code 1 if anything differs.  Usage: node test/compare.mjs test/out.json
import fs from "fs";
const FIELDS = ["hash", "title", "status", "keys", "shelf", "lang", "langBtns", "current", "missing", "body"];
const base = JSON.parse(fs.readFileSync(new URL("./baseline.json", import.meta.url))).trace;
const run = JSON.parse(fs.readFileSync(process.argv[2])).trace;
let n = 0;
if (base.length !== run.length) { console.log(`snapshot count ${run.length} != baseline ${base.length}`); n++; }
for (let i = 0; i < Math.min(base.length, run.length); i++) {
  for (const f of FIELDS) {
    if (JSON.stringify(base[i][f]) !== JSON.stringify(run[i][f])) {
      n++;
      console.log(`[${base[i].label}] ${f}\n  baseline: ${String(base[i][f]).slice(0, 240)}\n  now:      ${String(run[i][f]).slice(0, 240)}`);
    }
  }
}
console.log(n ? `${n} behaviour differences` : "behaviour identical to baseline");
process.exit(n ? 1 : 0);
