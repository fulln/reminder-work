import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : process.cwd();
const presentationRoot = join(root, "src", "presentation");
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
    else if (/\.css$/.test(path)) inspect(path);
  }
}

function inspect(path) {
  if (selected.size > 0 && !selected.has(path)) return;
  const text = readFileSync(path, "utf8");
  const rawColor = /(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\()/gi;
  for (const match of text.matchAll(rawColor)) {
    failures.push(
      `DESIGN-TOKEN-001 ${relative(process.cwd(), path)}: undeclared color ${match[0]}. Fix: add a semantic token in src/styles/tokens.css and reference var(--token).`,
    );
  }
}

visit(presentationRoot);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("design-token-check: component styles use semantic tokens");
