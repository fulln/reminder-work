#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hooks_dir="$repo_root/.git/hooks"

if [[ "$project_dir" != "$repo_root" ]]; then
  echo "install-git-hooks: Reminders.work must be the active repository root" >&2
  exit 1
fi

for hook in pre-commit pre-push; do
  source_path="$project_dir/.githooks/$hook"
  target_path="$hooks_dir/$hook"
  relative_source="../../.githooks/$hook"

  if [[ -e "$target_path" && ! -L "$target_path" ]]; then
    echo "install-git-hooks: refusing to replace existing $target_path" >&2
    exit 1
  fi

  ln -sfn "$relative_source" "$target_path"
done

echo "install-git-hooks: installed pre-commit and pre-push for Reminders.work"
