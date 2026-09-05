# backend — @kurotako/parser-prisma: `anchor` hook + resolve `@prisma/internals` from the schema dir

**Status**: to do
**Type**: backend
**Issue**: [#92](https://github.com/marmotz/kurotako/issues/92)

Reference: [../features/monorepo-projects/technical.md §2.5](../features/monorepo-projects/technical.md#25-parser-prisma).

## Verified

- `packages/parser-prisma/src/parser.ts:22-51` — `prismaParser` is declared via
  `defineParser({ name, optionsSchema, parse, watchPaths })`. `parse` calls
  `resolveInput(ctx.cwd, options, ctx.namespace)` (line 27); `watchPaths` returns
  `[resolve(ctx.cwd, options.schema)]` (line 49).
- `packages/parser-prisma/src/dmmf/load.ts:33-70` — `resolveInternals(ctx)` does
  `createRequire(join(ctx.cwd, 'noop.js'))` (line 36) then
  `require.resolve('@prisma/internals')` (line 40) and
  `require.resolve('@prisma/internals/package.json')` (line 60) — same `require`.
- `packages/parser-prisma/src/detect.ts:126` — `resolve(cwd, o.schema)`; `options.schema`
  is config-file-relative. **Not changed by this task.**
- `packages/parser-prisma/src/errors.ts:25-39` — `PrismaPeerMissingError` message tells
  the user to add `@prisma/internals` as a devDependency.
- `packages/parser-prisma/src/dmmf/load.test.ts` — `ctx()` helper builds
  `{ namespace, cwd, logger }`; `readDmmf(..., ctx(PKG_DIR))` relies on `@prisma/internals`
  being linked at the package root.

## To do

1. `packages/parser-prisma/src/parser.ts`: add an `anchor` member to the `defineParser`
   object:
   ```ts
   anchor(rootDir, options) {
     return dirname(resolve(rootDir, options.schema));
   },
   ```
   (import `dirname` from `node:path`; no `stat` — parent-of-folder is still a valid
   `node_modules` walk-up base.)
2. `packages/parser-prisma/src/dmmf/load.ts`, `resolveInternals`: replace
   `join(ctx.cwd, 'noop.js')` with `join(ctx.anchorDir ?? ctx.cwd, 'noop.js')`. Nothing
   else changes — both `require.resolve` calls share that `require`.
3. `packages/parser-prisma/src/errors.ts`: extend `PrismaPeerMissingError`'s message to
   note that in a monorepo it may be installed in the sub-project holding the schema, not
   only at the repo root.
4. Tests:
   - `packages/parser-prisma/src/parser.test.ts`: `prismaParser.anchor!(rootDir, { schema:
     './libs/db/prisma/schema.prisma', ... })` returns `<rootDir>/libs/db/prisma`;
   - `dmmf/load.test.ts`: `readDmmf` with `ctx` where `anchorDir` points at a directory
     with **no** resolvable `@prisma/internals` and `cwd` points at one that has it ⇒
     `PrismaPeerMissingError` (proves `anchorDir` wins over `cwd`); and the mirror case
     (`anchorDir` resolvable, `cwd` not) ⇒ succeeds. Add an `anchorDir` field to the
     `ctx()` helper for these.
   - updated `PrismaPeerMissingError` message assertion.
5. Changeset for `@kurotako/parser-prisma` (notable fix: `@prisma/internals` now resolves
   from the schema directory).
6. `bun run typecheck`, `bun run test`, `bun run build` green for
   `packages/parser-prisma`.

## Dependencies

Depends on #89
Depends on #91

- [89-core-parse-context-anchor-dir](89-core-parse-context-anchor-dir.md) —
  `ctx.anchorDir` must exist.
- [91-config-parser-anchor-currying](91-config-parser-anchor-currying.md) —
  `defineParser` must accept an `anchor` member and `load.ts` must curry it.
