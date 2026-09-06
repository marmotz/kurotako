# backend — @kurotako/config: `TakoParser.anchor`, `defineParser`, currying in `load.ts`

**Status**: done
**Type**: backend
**Issue**: [#91](https://github.com/marmotz/kurotako/issues/91)

Reference: [../features/monorepo-projects/technical.md §2.2](../features/monorepo-projects/technical.md#22-parseranchor-hook-core--config),
[§2.3](../features/monorepo-projects/technical.md#23-currying-in-configloadts),
[§1.3](../features/monorepo-projects/technical.md#13-defineparser-currying).

## Verified

- `packages/config/src/types.ts:26-33` — `TakoParser<O>` declares
  `parse(ctx, options)` and `watchPaths?(ctx, options)`.
- `packages/config/src/define-driver.ts:19-36` — `defineParser` types the same two
  members against the schema Output (`DriverOptions<S>`); runtime is identity.
- `packages/config/src/load.ts:156-163` — the source loop builds a plain `Parser`
  `{ name, parse: (ctx) => use.parse(ctx, parsedOptions) }` and, when `use.watchPaths`
  exists, binds `parser.watchPaths = (ctx) => watchPaths(ctx, parsedOptions)`. `rootDir`
  is in scope there (line 60).
- `packages/config/src/define.test-d.ts` covers `defineParser` option-inference type
  tests — the new member needs a type-test line.

## To do

1. `packages/config/src/types.ts`: `TakoParser<O>` gains
   `anchor?(rootDir: string, options: O): string | undefined | Promise<string | undefined>`.
2. `packages/config/src/define-driver.ts`: `defineParser`'s driver param gains the same
   `anchor?(rootDir, options: DriverOptions<S>)` member (mirrors the `watchPaths` entry).
3. `packages/config/src/load.ts`, source loop: after the `watchPaths` binding, add
   ```ts
   if (use.anchor) {
     const anchor = use.anchor.bind(use);
     parser.anchor = (rootDir) => anchor(rootDir, parsedOptions);
   }
   ```
   (`use` is the `TakoParser<unknown>` cast already in scope.)
4. Tests:
   - `packages/config/src/load.test.ts`: a fake parser declaring `anchor(rootDir, options)`
     ⇒ after `loadConfig`, `resolved.sources[ns].parser.anchor!(rootDir)` returns the
     value computed from the curried (validated) options, and the driver's `anchor`
     received the parsed options, not the raw entry;
   - a parser without `anchor` ⇒ `resolved.sources[ns].parser.anchor` is `undefined`.
   - `packages/config/src/define.test-d.ts`: `anchor`'s `options` parameter is inferred as
     the schema Output.
5. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/config`.

## Dependencies

Depends on #89

- [89-core-parse-context-anchor-dir](89-core-parse-context-anchor-dir.md) — `load.ts`
  builds a `@kurotako/core` `Parser`; the `anchor` member must exist on core's type first.
