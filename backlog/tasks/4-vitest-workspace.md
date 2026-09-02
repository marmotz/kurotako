# CI — Vitest workspace setup

**Status**: to do **Type**: CI **Issue**: [#4](https://github.com/marmotz/kurotako/issues/4)

Reference: [../features/monorepo-bootstrap/technical.md §Tests — vitest](../features/monorepo-bootstrap/technical.md#tests--vitest).

## To do

1. Create `vitest.workspace.ts` at the root globbing `packages/*/vitest.config.ts`.
2. Add `vitest` and `@vitest/coverage-v8` as root devDependencies.
3. Wire the root `test` script = `vitest run`.
4. Coverage available but not gating in v1 (no threshold).

## Dependencies

- [#1](1-root-workspace-scaffold.md)
