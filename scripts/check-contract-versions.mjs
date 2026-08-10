import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : process.cwd();
const contractRoots = [
  join(root, "src", "application", "contracts"),
  join(root, "src", "infrastructure", "cloudflare", "queues"),
  join(root, "src", "infrastructure", "cloudflare", "workflows"),
];
const failures = [];
const selected = new Set(
  (process.env.GUARD_FILES ?? "")
    .split(",")
    .filter(Boolean)
    .map((file) => join(process.cwd(), file)),
);

function visit(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) visit(path);
    else if (/\.(?:ts|tsx)$/.test(path)) inspect(path);
  }
}

function inspect(path) {
  if (selected.size > 0 && !selected.has(path)) return;
  const text = readFileSync(path, "utf8");
  if (
    /(?:interface|type|const)\s+\w*(?:Message|Persisted|Payload)\b/.test(
      text,
    ) &&
    !/schemaVersion/.test(text)
  ) {
    failures.push(
      `CONTRACT-VERSION-001 ${relative(process.cwd(), path)}: persisted or asynchronous payload has no version. Fix: add a literal schemaVersion and validate it at the boundary.`,
    );
  }
}

contractRoots.forEach(visit);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("contract-version-check: versioned boundaries passed");
