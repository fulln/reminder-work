#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
constitution="$project_dir/.specify/memory/constitution.md"
architecture="$project_dir/docs/architecture.md"

fail() {
  echo "governance-check: $1" >&2
  exit 1
}

[[ -f "$constitution" ]] || fail "missing project constitution"
[[ -f "$architecture" ]] || fail "missing architecture document"

if grep -Eq '\[(PROJECT_NAME|PRINCIPLE_[0-9]+_(NAME|DESCRIPTION)|SECTION_[0-9]+_(NAME|CONTENT)|GOVERNANCE_RULES|CONSTITUTION_VERSION|RATIFICATION_DATE|LAST_AMENDED_DATE)\]' "$constitution"; then
  fail "constitution contains unresolved template placeholders"
fi

grep -Eq '^\*\*Version\*\*: [0-9]+\.[0-9]+\.[0-9]+ \| \*\*Ratified\*\*: [0-9]{4}-[0-9]{2}-[0-9]{2} \| \*\*Last Amended\*\*: [0-9]{4}-[0-9]{2}-[0-9]{2}$' "$constitution" \
  || fail "constitution version/date line is invalid"

for markdown_file in "$constitution" "$architecture"; do
  fence_count="$(grep -c '^```' "$markdown_file" || true)"
  if (( fence_count % 2 != 0 )); then
    fail "unbalanced fenced code blocks in ${markdown_file#$project_dir/}"
  fi
done

feature_file="$project_dir/.specify/feature.json"
if [[ -f "$feature_file" ]]; then
  feature_dir="$(sed -n 's/.*"feature_directory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$feature_file")"
  [[ -n "$feature_dir" ]] || fail "cannot parse .specify/feature.json"
  spec_file="$project_dir/$feature_dir/spec.md"
  [[ -f "$spec_file" ]] || fail "active feature is missing spec.md"
  if grep -Eq '\[(FEATURE NAME|###-feature-name|DATE)\]|\[NEEDS CLARIFICATION:' "$spec_file"; then
    fail "active specification contains unresolved placeholders or clarifications"
  fi

  plan_file="$project_dir/$feature_dir/plan.md"
  if [[ -f "$plan_file" ]] && grep -Eq 'NEEDS CLARIFICATION|\[(FEATURE|DATE|LINK|PROJECT TYPE)\]' "$plan_file"; then
    fail "active plan contains unresolved placeholders or clarifications"
  fi
fi

echo "governance-check: passed"
