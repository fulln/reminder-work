import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const assets = join(process.cwd(), "build", "client", "assets");
if (!existsSync(assets)) {
  console.error(
    "PERF-BUDGET-001 build/client/assets is missing. Fix: run npm run build before the budget check.",
  );
  process.exit(1);
}

const totals = { js: 0, css: 0 };
for (const file of readdirSync(assets)) {
  const path = join(assets, file);
  if (!statSync(path).isFile()) continue;
  if (file.endsWith(".js"))
    totals.js += gzipSync(readFileSync(path)).byteLength;
  if (file.endsWith(".css"))
    totals.css += gzipSync(readFileSync(path)).byteLength;
}

const budgets = { js: 140 * 1024, css: 30 * 1024 };
const failures = Object.entries(totals).filter(
  ([kind, bytes]) => bytes > budgets[kind],
);
if (failures.length > 0) {
  for (const [kind, bytes] of failures)
    console.error(
      `PERF-BUDGET-002 ${kind}: ${bytes} bytes exceeds ${budgets[kind]}. Fix: remove or split public-route code.`,
    );
  process.exit(1);
}
console.log(
  `performance-budget: JS ${totals.js} / ${budgets.js} bytes; CSS ${totals.css} / ${budgets.css} bytes (gzip)`,
);
