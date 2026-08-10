import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(process.cwd(), "docs/architecture/exceptions");
const required = [
  "ruleId",
  "owner",
  "rationale",
  "risk",
  "expiresWhen",
  "removalTask",
  "affectedPaths",
];
const failures = [];

if (existsSync(root)) {
  for (const entry of readdirSync(root)) {
    if (!entry.endsWith(".json") || entry === "schema.json") continue;
    const path = join(root, entry);
    const file = relative(process.cwd(), path);
    let value;
    try {
      value = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      failures.push(
        `GOVERNED-EXCEPTION-JSON ${file}: invalid JSON. Fix: make the exception a valid schema document.`,
      );
      continue;
    }
    for (const field of required) {
      if (value[field] === undefined || value[field] === "")
        failures.push(
          `GOVERNED-EXCEPTION-FIELD ${file}: missing ${field}. Fix: complete every governance field.`,
        );
    }
    const expiration = Date.parse(value.expiresWhen);
    if (Number.isNaN(expiration) || expiration <= Date.now())
      failures.push(
        `GOVERNED-EXCEPTION-EXPIRED ${file}: expiresWhen is invalid or elapsed. Fix: remove the exception or document a future review date.`,
      );
    if (
      !Array.isArray(value.affectedPaths) ||
      value.affectedPaths.some(
        (path) =>
          path === "*" ||
          path === "**/*" ||
          path.includes("..") ||
          !/^(src|tests|scripts|docs)\//.test(path),
      )
    ) {
      failures.push(
        `GOVERNED-EXCEPTION-SCOPE ${file}: affectedPaths is overly broad or unsafe. Fix: list narrow project-relative paths.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  "governed-exception-check: active exceptions are complete and scoped",
);
