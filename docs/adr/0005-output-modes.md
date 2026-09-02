# 0005 - Two output modes: directory or npm package

**Status**: Accepted

**Date**: 2026-09-01

## Context

Once it was decided that each source produces its own submodule ([ADR-0004](0004-ir-namespace-first.md)), it remains to
choose how that code reaches the consumer's imports. Two strategies, each suited to a different context (simple mono-app
project vs multi-app monorepo).

## Decision

Support both, selected by the `output` config.

### Mode A — directory (default)

```yaml
output:
  dir: ./generated/kurotako
```

`tako` writes a directory of submodules inside the project. Import by relative path or by tsconfig alias `@kurotako/*` →
`./generated/kurotako/*`. Nothing to publish or install.

### Mode B — npm package per source

```yaml
output:
  mode: package
  packagesDir: ./packages
  scope: '@kurotako'
```

`tako` generates a complete package per source (`package.json`, `exports`, possible build). Standard node resolution, no
`paths` config. The consumer declares the dependency (`workspace:*` in a monorepo) and re-runs install on the first
`generate`.

The module name (`@kurotako/pg`) is identical in both modes.

## Consequences

### Positive

- The simple project stays a single command; the monorepo gets native resolution without config replicated in every
  tool.
- A → B migration without changing the application imports.

### Negative / costs

- `tako` must know how to generate and maintain a `package.json` per source in mode B, and handle (or not) a build step.
- Two code paths to test in the CLI and the generators.

### Neutral

- The choice of package manager and builder for mode B is an open question (see the
  `output-modes` feature).

## Rejected alternatives

- **Mode A only**: in a monorepo, forces multiple generation or a shared package hand-assembled.
- **Mode B only**: too heavy for a simple mono-app project.
