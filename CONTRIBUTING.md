# Contributing

Thank you for helping improve Reminder.work.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm ci`.
3. Copy `.dev.vars.example` to `.dev.vars` for local development.
4. Make a small, documented change that respects the existing module boundaries.
5. Run `npm run verify` before opening a pull request.

Changes to public behavior should include tests. Architecture or contract changes must
also update the relevant documents under `docs/` or `specs/`.

## Pull requests

Keep pull requests focused and explain:

- the problem being solved;
- the chosen approach and notable tradeoffs;
- user-visible or operational impact;
- the checks used to validate the change.

Do not commit `.dev.vars`, credentials, production identifiers, reminder content, or
recipient information.

By contributing, you agree that your contributions will be licensed under the MIT
License.
