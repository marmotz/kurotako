# CI — Shared tsup build preset

**Status**: to do **Type**: CI **Issue**: [#3](https://github.com/marmotz/kurotako/issues/3)

Reference: [../features/monorepo-bootstrap/technical.md §Build — tsup](../features/monorepo-bootstrap/technical.md#build--tsup).

## To do

1. Create `tsup.config.base.ts` at the root exporting `basePreset: Options`:
   `entry: ['src/index.ts']`, `format: ['esm', 'cjs']`, `dts: true`, `sourcemap: true`,
   `clean: true`, `target: 'node24'`, `outDir: 'dist'`.
2. Add `tsup` as a root devDependency.
3. Wire the root `build` script (fan-out `bun run --filter '*' build`).
4. Check that `dist` is properly ignored by the root `.gitignore` (added by
   [#1](1-root-workspace-scaffold.md)).

## Dependencies

- [#1](1-root-workspace-scaffold.md)
