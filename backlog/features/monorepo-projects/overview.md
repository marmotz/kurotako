# Running `tako` in a consumer monorepo

**Status**: in discussion

## Context

First real use of `tako` was against `viktor`, itself a monorepo:

- `tako.config.ts` at the repo root;
- the Prisma schema in a sub-project: `libs/db/prisma/schema.prisma`;
- Prisma (and therefore `@prisma/internals`) is a concern of `libs/db`, not the root.

Observed:

1. `tako generate` failed with `prisma_peer_missing` (surfaced as `driver_error` — see the
   `renderError` cause note below) until `@prisma/internals` was installed. Installing it
   in `libs/db` (next to the schema) did **not** help. Installing it at the **repo root**
   did.
2. The user's objection: kurotako must not force `@prisma/internals` (a heavy dep that
   pulls `@prisma/engines` and downloads a schema-engine binary) into the monorepo root.
   And more generally: how does a single root `tako.config.ts` handle **sources that live
   in different sub-projects** and **outputs targeted at different sub-projects**?

## Why (1) happens

[`packages/parser-prisma/src/dmmf/load.ts`](../../../packages/parser-prisma/src/dmmf/load.ts)
`resolveInternals` does:

```ts
const require = createRequire(join(ctx.cwd, 'noop.js'));
entry = require.resolve('@prisma/internals');
```

`ctx.cwd` is `rootDir` — the directory of `tako.config.ts` (from
[`config/load.ts`](../../../packages/config/src/load.ts): `rootDir = resolve(configFile, '..')`).
So `@prisma/internals` is resolved from the **config file's directory**, not from the
schema file's directory. `libs/db/node_modules/@prisma/internals` is never consulted;
`<root>/node_modules/@prisma/internals` is.

Same reasoning will apply to any future parser that dynamically resolves a
schema-toolchain dependency from `ctx.cwd`.

## Goal

`tako` is usable from the root of a consumer monorepo without hoisting every parser's
toolchain dependency to the root: each source resolves its own tooling from where that
source (its schema) lives, and outputs can be directed per sub-project.

## Decisions made

_(none yet — to be settled in discussion)_

## Open questions

### Dependency resolution per source

- Resolve `@prisma/internals` (and equivalents) from the **schema file's directory** and
  walk up, instead of from `ctx.cwd`? That would make `libs/db/node_modules` work and
  still fall back to the root.
- Or add a `ParseContext` field for "the directory this source is anchored at" that the
  parser uses for both schema resolution and dependency resolution?
- Or an explicit escape hatch: a parser option pointing at the toolchain package
  (`internalsFrom: './libs/db'`)?
- Keep `@prisma/internals` an **optional peer** of `@kurotako/parser-prisma` (it already
  is) — the question is only the resolution base, not whether kurotako bundles it.

### Multiple sources / multiple outputs across sub-projects

- A root config with `sources: { db: …, auth: … }` where each schema is in a different
  package — does anything today assume a single anchor directory? (`rootDir` is used for
  parser `cwd` **and** as the base for relative `output.dir`.)
- Should `output` allow **per-namespace** targets (e.g. generated Zod for `db` lands in
  `libs/db/src/generated`, generated Angular for `db` lands in `apps/web/src/generated`)?
  Currently `output.dir` is a single directory; `output-modes` mode B is "one npm package
  per source" but still under one `packagesDir`.
- Interaction with [output-modes](../output-modes/overview.md): is "per sub-project
  output" a third mode, or a refinement of mode A (`output.dir` becomes a function of
  `namespace` / `generator`)?
- Does `tako init` need a `--monorepo` awareness, or is documentation enough?

### Error surfacing (minor, noted here)

- `prisma_peer_missing` / `prisma_schema_invalid` are precise `TakoError`s but
  `@kurotako/core` `run()` re-wraps any non-`DriverError` throw into a generic
  `DriverError`, and `cli` `renderError` does not print `error.cause`. Result: the user
  saw only `parser 'prisma' … threw during parse`. Fix candidates: `run()` should rethrow
  any `TakoError` unchanged (like it already does for `DriverError`); and/or
  `renderError` should append `cause`. Small, could be folded into
  [core-pipeline](../core-pipeline/overview.md) / [cli](../cli/overview.md) rather than this
  feature.

## Depends on / touches

- [`@kurotako/parser-prisma`](../parser-prisma/overview.md) — `dmmf/load.ts`
  resolution base, `detect.ts`, options.
- [`@kurotako/core`](../core-pipeline/overview.md) — `ParseContext` shape, `run()` error
  rewrapping.
- [`@kurotako/config`](../config-system/overview.md) — `rootDir` semantics, `output`
  resolution.
- [output-modes](../output-modes/overview.md) — per-project / per-namespace output.
- [cli](../cli/overview.md) — `renderError` cause, `tako init`.
