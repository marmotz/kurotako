# docs — "Using tako in a monorepo" page + move example tooling into the sub-project

**Status**: done
**Type**: docs
**Issue**: [#93](https://github.com/marmotz/kurotako/issues/93)

Reference: [../features/monorepo-projects/technical.md §4 Consequences](../features/monorepo-projects/technical.md#4-consequences).

## Verified

- `apps/docs/docs/` has `getting-started/`, `concepts/`, `reference/` (incl.
  `reference/output-modes.md`, `reference/tako-config.md`, `reference/cli.md`).
- `examples/nestjs11-prisma7-angular22-outputdir/package.json` declares
  `@prisma/internals` + `prisma` as **root** devDependencies;
  `examples/.../apps/backend/package.json` has only the Prisma runtime
  (`@prisma/client`, `@prisma/adapter-better-sqlite3`, `prisma`), not `@prisma/internals`.

## To do

1. New page `apps/docs/docs/reference/monorepo.md` (or under `getting-started/` — match
   the sidebar): consumer monorepo layout, `tako.config.ts` at the root, schema in a
   sub-project. Cover:
   - `options.schema` is resolved relative to the **config file**, not the schema's
     package;
   - `@prisma/internals` is resolved from the **schema's directory** (walking up), so it
     can live in the sub-project holding the schema;
   - per-sub-project outputs via `outputs[]` + the `generators` filter (link
     `reference/output-modes.md`);
   - `tako init --monorepo` and its auto-detection.
   Add it to `sidebars` / cross-link from `getting-started/installation.md` and
   `reference/tako-config.md`.
2. `examples/nestjs11-prisma7-angular22-outputdir`: move `@prisma/internals` from the root
   `package.json` devDependencies into `apps/backend/package.json`, to demonstrate the new
   resolution. Re-run the example's `tako generate` and its checks; update the example
   `README.md` if it mentions the root install.
3. Docs build green: `bun run --filter @kurotako/docs build` (or the repo's docs check).

## Dependencies

Depends on #92
Depends on #90

- [92-parser-prisma-anchor-internals-resolution](92-parser-prisma-anchor-internals-resolution.md)
  — the example only works with `@prisma/internals` in the sub-project once resolution is
  anchored on the schema dir.
- [90-cli-tako-init-monorepo](90-cli-tako-init-monorepo.md) — the page documents
  `tako init --monorepo`.
