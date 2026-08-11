# Reminders.work Git hooks

These hooks are tracked with the standalone Reminders.work repository and installed as
symlinks in its `.git/hooks` directory.

- `pre-commit` runs when repository files are staged. It rejects likely secret files,
  checks staged whitespace, validates Spec Kit governance, and runs `npm run guard:staged`
  when that script exists.
- `pre-push` validates Spec Kit governance and runs `npm run verify` when that script
  exists. The future `verify` script is the single entry point for format, lint,
  architecture, type, test, build, accessibility, and critical browser gates.

Hooks fail closed. Bypassing with `--no-verify` is reserved for recovering a broken hook;
the skipped checks must run before the next push.

Install or refresh both hooks from the repository root:

```bash
./scripts/install-git-hooks.sh
```

The installer is idempotent and refuses to overwrite a non-symlink hook owned by another
project.
