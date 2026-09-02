# CI — lefthook git hooks

**Status**: done **Type**: CI **Issue**: [#7](https://github.com/marmotz/kurotako/issues/7)

Reference: [../features/monorepo-bootstrap/technical.md §Git hooks — lefthook](../features/monorepo-bootstrap/technical.md#git-hooks--lefthook).

## To do

1. Create `lefthook.yml`: parallel `pre-commit` with
    - `biome`: `bunx biome check --no-errors-on-unmatched --staged {staged_files}` on
      `*.{ts,tsx,js,json,jsonc}`;
    - `typecheck`: `bun run typecheck` (`tsc -b`, incremental).
2. Add `lefthook` as a root devDependency.
3. Wire the root `prepare` script = `lefthook install`.
4. Keep `typecheck` on `pre-commit` for now; moving it to `pre-push` is possible later if the latency becomes annoying.

## Dependencies

- [#2](2-shared-typescript-config.md)
- [#5](5-biome-lint-format.md)
