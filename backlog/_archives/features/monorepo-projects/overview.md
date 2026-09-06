# Running `tako` in a consumer monorepo

**Status**: technical design ready — see [`technical.md`](./technical.md)

## Context

First real use of `tako` was against `viktor`, itself a monorepo:

- `tako.config.ts` at the repo root;
- the Prisma schema in a sub-project: `libs/db/prisma/schema.prisma`;
- Prisma (and therefore `@prisma/internals`) is a concern of `libs/db`, not the root.

Observed: `tako generate` failed with `prisma_peer_missing` until `@prisma/internals`
was installed **at the repo root**. Installing it in `libs/db` (next to the schema) did
not help. The user's objection: kurotako must not force `@prisma/internals` (a heavy dep
that pulls `@prisma/engines` and downloads a schema-engine binary) into the monorepo
root just because the config file lives there.

## Already handled elsewhere (do not re-litigate)

Two of the three concerns from the original draft have since been solved outside this
feature:

- **Outputs targeted at different sub-projects** — `outputs[]`
  ([`ResolvedConfig.outputs`](../../../../packages/core/src/types.ts), `OutputConfig`) is
  now an array; each entry has its own `dir` / `mode` and an optional `generators`
  filter. `GeneratorConfig.namespaces` narrows a generator to a subset of namespaces.
  The `examples/nestjs11-prisma7-angular22-outputdir` project demonstrates a root
  config emitting Zod into `apps/backend` and Angular into `apps/frontend`. See
  [output-modes](../output-modes/overview.md).
- **Unreadable error** — `cli` `renderError`
  ([`packages/cli/src/errors.ts`](../../../../packages/cli/src/errors.ts)) now prints the
  wrapped `cause` with its `TakoError` code, so `prisma_peer_missing` is visible even
  though `@kurotako/core` `run()` still rewraps it into a generic `DriverError`. Any
  further tightening (having `run()` rethrow `TakoError`s unchanged) belongs in
  [core-pipeline](../core-pipeline/overview.md).

## Goal

`tako` is usable from the root of a consumer monorepo without hoisting a parser's
schema-toolchain dependency to the root: each source resolves its own tooling from
where that source's schema lives.

## The remaining problem — toolchain resolution base

[`packages/parser-prisma/src/dmmf/load.ts`](../../../../packages/parser-prisma/src/dmmf/load.ts)
`resolveInternals` does:

```ts
const require = createRequire(join(ctx.cwd, 'noop.js'));
entry = require.resolve('@prisma/internals');
```

`ctx.cwd` is `config.rootDir` — the directory of `tako.config.ts`
([`run.ts`](../../../../packages/core/src/run.ts), `cwd: config.rootDir`;
[`config/load.ts`](../../../../packages/config/src/load.ts), `rootDir = resolve(configFile, '..')`).
So `@prisma/internals` is resolved from the config file's directory, never from the
schema file's directory. `libs/db/node_modules/@prisma/internals` is never consulted.
`options.schema` itself is also resolved against `ctx.cwd`
([`detect.ts`](../../../../packages/parser-prisma/src/detect.ts), `resolve(cwd, o.schema)`).

The same reasoning applies to any future parser that dynamically resolves a
schema-toolchain dependency.

## Decisions made

- **Per-source anchor directory.** A source's schema-toolchain dependency
  (`@prisma/internals` and future equivalents) is resolved from the directory the
  source's schema lives in, letting Node walk up `node_modules` to the repo root as a
  natural fallback. No hoisting to the config-file directory required.
- **Core concern, not parser-specific.** `@kurotako/core` gains a new
  `ParseContext.anchorDir` (the resolved source directory). Every current and future
  parser that resolves a toolchain dependency uses it. `ParseContext.cwd` is unchanged.
- **Anchor is reported by the parser.** The `Parser` contract gains an optional
  `anchor?(options, rootDir): string | undefined` hook: the parser (which alone
  understands its options) returns the source directory; `run()` calls it before
  `parse()` and falls back to `rootDir` when it is absent or returns `undefined`.
  `parser-prisma` returns `dirname(resolve(rootDir, options.schema))`.
- **`options.schema` resolution is untouched.** It stays relative to `rootDir` (the
  config-file directory). `anchorDir` only changes the resolution base for the
  toolchain dependency, so existing configs keep working with no change.
- **`@prisma/internals` stays an optional peer** of `@kurotako/parser-prisma`.
  kurotako never bundles it; only the resolution base changes.
- **`tako init` monorepo mode.** Auto-detected from a `workspaces` field in the nearest
  `package.json`; a `--monorepo` flag forces it. In that mode the scaffolded config
  points `sources` / `outputs` at sub-project paths with adapted comments.

## Open questions

_(none — ready for `technical.md`)_

## Depends on / touches

- [`@kurotako/parser-prisma`](../parser-prisma/overview.md) — `dmmf/load.ts` and
  `detect.ts` resolution base, options.
- [`@kurotako/core`](../core-pipeline/overview.md) — `ParseContext` shape.
- [`@kurotako/config`](../config-system/overview.md) — `rootDir` semantics.
- [output-modes](../output-modes/overview.md) — already covers per-project output.
- [cli](../cli/overview.md) — `tako init`.
