# CI — Root workspace scaffold (Bun)

**Status**: to do **Type**: CI **Issue**: [#1](https://github.com/marmotz/kurotako/issues/1)

Reference: [../features/monorepo-bootstrap/technical.md §Package manager — Bun workspaces](../features/monorepo-bootstrap/technical.md#package-manager--bun-workspaces).

## Verified state

The repo has no `package.json` and no tooling. `git remote` points to
`git@github.com:marmotz/kurotako.git` (the GitHub repository exists, no code pushed yet).
Existing directories not to ignore: `docs/`, `backlog/`, `.serena/` (the latter already has its own `.gitignore`).

## To do

1. Create the root `package.json`: `"private": true`, `"workspaces": ["packages/*"]`,
   `"packageManager": "bun@<latest>"`, `"engines": { "node": ">=24", "bun": ">=<latest>" }`,
   `"type": "module"`.
2. Add the root aggregate scripts (placeholders to be completed by the following tasks): `build`,
   `typecheck`, `test`, `lint`, `format`, `prepare`, `release`.
   See [§Root aggregate scripts](../features/monorepo-bootstrap/technical.md#root-aggregate-scripts).
3. `bun install` to generate `bun.lock` (text format), commit it.
4. Root `.gitignore`: `node_modules`, `dist`, `*.tsbuildinfo`, `coverage`, `.DS_Store`.
5. `.node-version` = `24`.
6. `.editorconfig`: UTF-8, LF, final newline, 2-space indent.

## Dependencies

None.
