# backend — core: `ParseContext.anchorDir` + `Parser.anchor` hook + `run()` wiring

**Status**: done
**Type**: backend
**Issue**: [#89](https://github.com/marmotz/kurotako/issues/89)

Reference: [../features/monorepo-projects/technical.md §2.1](../features/monorepo-projects/technical.md#21-parsecontextanchordir-core),
[§2.2](../features/monorepo-projects/technical.md#22-parseranchor-hook-core--config),
[§2.4](../features/monorepo-projects/technical.md#24-run-wiring-core).

## Verified

- `packages/core/src/types.ts:91-95` — `ParseContext` is exactly
  `{ namespace: string; cwd: string; logger: Logger }`.
- `packages/core/src/types.ts:81-89` — `Parser` is `{ name; parse(ctx); watchPaths?(ctx) }`.
- `packages/core/src/run.ts:53-57` — the only `ParseContext` for `parse()` is built inline
  as `{ namespace, cwd: config.rootDir, logger: childLogger(...) }`; the surrounding
  `try/catch` (lines 58-66) wraps any non-`DriverError` throw as
  `DriverError('parser', parser.name, { cause, namespace })`.
- `packages/cli/src/watch.ts:107-113` builds a `ParseContext`-shaped literal for
  `source.parser.watchPaths?.(...)` with no `anchorDir` — must keep compiling, hence the
  new field is optional.
- `packages/parser-prisma/src/parser.test.ts:68` and
  `packages/parser-prisma/src/dmmf/load.test.ts:14` have shared `ctx()` helpers that build
  `ParseContext` literals — optional field ⇒ no change needed there.

## To do

1. `packages/core/src/types.ts`:
   - `ParseContext` gains `anchorDir?: string` — absolute; the directory the source is
     anchored at (where its schema lives). A parser resolves the source's own toolchain
     dependencies from here. Absent ⇒ treat as `cwd`. Document it as shown in
     technical.md §2.1.
   - `Parser` gains
     `anchor?(rootDir: string): string | undefined | Promise<string | undefined>` —
     already-curried hook; `run()` calls it before `parse()` and passes the result as
     `ParseContext.anchorDir`; returning `undefined` (or omitting the hook) anchors on
     `rootDir`. Document that it must not throw for an ordinary "not found" case.
2. `packages/core/src/run.ts`, parse loop (lines 46-67): before building `ctx`, compute
   `const anchorDir = (await source.parser.anchor?.(config.rootDir)) ?? config.rootDir;`
   and add `anchorDir` to the `ctx` literal. Leave the `try/catch` as-is (a throw from
   `anchor()` becoming a `DriverError` is acceptable).
3. Tests in `packages/core/src/run.test.ts`:
   - a parser exposing `anchor` that returns a fixed dir ⇒ `parse` receives that value as
     `ctx.anchorDir`;
   - a parser with no `anchor` ⇒ `ctx.anchorDir === config.rootDir`;
   - a parser whose `anchor` returns `undefined` ⇒ `ctx.anchorDir === config.rootDir`;
   - an `async` `anchor` is awaited.
4. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/core`.

## Dependencies

Aucune.
