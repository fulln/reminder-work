import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : process.cwd();
const sourceRoot = join(root, "src");
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
    else if ([".ts", ".tsx"].includes(extname(path))) inspect(path);
  }
}

function inspect(path) {
  if (selected.size > 0 && !selected.has(path)) return;
  const file = relative(process.cwd(), path);
  const text = readFileSync(path, "utf8");
  if (
    /src\/domain\//.test(file) &&
    /from ["'](?:react|react-router|cloudflare:)/.test(text)
  ) {
    failures.push(
      `ARCH-DOMAIN-001 ${file}: domain cannot import UI/runtime modules. Fix: move framework behavior to presentation or a runtime adapter.`,
    );
  }
  if (
    /src\/application\//.test(file) &&
    /from ["']~\/infrastructure\//.test(text)
  ) {
    failures.push(
      `ARCH-APPLICATION-001 ${file}: depend on a port, not an adapter. Fix: define an application port and inject its adapter.`,
    );
  }
  if (
    /src\/presentation\//.test(file) &&
    /from ["']~\/infrastructure\//.test(text)
  ) {
    failures.push(
      `ARCH-PRESENTATION-001 ${file}: route through an application use case. Fix: call an application service from the route context.`,
    );
  }
}

visit(sourceRoot);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("architecture-check: source boundaries passed");
