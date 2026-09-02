# CI — Biome lint + format

**Status**: to do **Type**: CI **Issue**: [#5](https://github.com/marmotz/kurotako/issues/5)

Reference: [../features/monorepo-bootstrap/technical.md §Lint + format — Biome](../features/monorepo-bootstrap/technical.md#lint--format--biome).

## To do

1. Create `biome.json`: `linter.rules.recommended = true`, formatter enabled (spaces, single quotes, trailing commas)
   consistent with `.editorconfig`.
2. Add `@biomejs/biome` as a root devDependency.
3. Wire the root scripts `lint` = `biome check .` and `format` = `biome format --write .`.
4. Stay on `recommended` only; hardening is a separate later change.

## Dependencies

- [#1](1-root-workspace-scaffold.md)
