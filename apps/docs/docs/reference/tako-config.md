---
title: tako.config.ts
sidebar_position: 1
---

# `tako.config.ts` reference

`tako` is driven by a `tako.config.ts` file at the root of your project (it is resolved
by walking up from the current directory). The file default-exports the result of
`defineConfig`.

```ts
import { defineConfig } from 'kurotako';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {
    db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [{ use: zodGenerator }, { use: angularGenerator }],
  outputs: [{ dir: './generated/kurotako' }],
});
```

`defineConfig` is re-exported from the `kurotako` umbrella package. If your project
depends on `@kurotako/config` directly instead, import it from there — that is the only
line that changes.

## `defineConfig(config)`

Identity at runtime — it returns its argument unchanged. Its job is purely typing: it
infers each entry's `options` type from the parser/generator's `optionsSchema`, makes
required options mandatory, and flags unknown keys. A plain object works too, but you lose
the inference.

## `sources`

A record. **Each key is a [namespace](../concepts/namespaces.md)** and must match
`^[a-z][a-zA-Z0-9]*$`. At least one source is required.

| Field | Type | Notes |
|---|---|---|
| `use` | parser | the parser exported by a `@kurotako/parser-*` package |
| `options` | parser-specific | validated against the parser's `optionsSchema`; required only if the schema has a required field |

```ts
sources: {
  pg: { use: prismaParser, options: { schema: './prisma/pg.prisma' } },
  crm: { use: prismaParser, options: { schema: './prisma/crm.prisma' } },
}
```

`options.schema` is resolved **relative to this config file's directory**, even when it
points into a sub-project. `@prisma/internals` is then resolved from the schema's own
directory, so in a monorepo it can live in that sub-project — see
[Using tako in a monorepo](monorepo.md).

## `generators`

An **array** of entries. Order is irrelevant — `core` resolves the
[dependency graph](../concepts/dependency-graph.md).

| Field | Type | Notes |
|---|---|---|
| `use` | generator | the generator exported by a `@kurotako/gen-*` package |
| `options` | generator-specific | validated against the generator's `optionsSchema` |
| `namespaces` | `string[]` | restrict this generator's IR view; default = every namespace |

```ts
generators: [
  { use: zodGenerator, options: { zodVersion: 4 } },
  { use: angularGenerator, namespaces: ['pg'] },
]
```

If a generator declares `dependsOn: ['x']` and `x` is not in the array, `loadConfig`
fails.

## `outputs`

An **array**, at least one entry. Each entry is one destination.

| Field | Type | Default | Notes |
|---|---|---|---|
| `mode` | `'dir'` \| `'package'` | `'dir'` | A = directory tree, B = one npm package per namespace |
| `dir` | `string` | `'./generated/kurotako'` | mode A output root; relative paths resolve against the config file's directory |
| `packagesDir` | `string` | — | **required for mode B** — where the generated packages are written |
| `scope` | `string` | — | **required for mode B** — the npm scope; a package is named `${scope}/${namespace}` |
| `packageManager` | `'bun'` \| `'pnpm'` \| `'yarn'` \| `'npm'` | auto-detected | mode B — used for the auto-install |
| `generators` | `string[]` | all | restrict this destination to a subset of generators |

```ts
outputs: [
  { dir: './generated/kurotako' },
  { mode: 'package', packagesDir: './packages', scope: '@myapp' },
]
```

See [Output modes](output-modes.md) for the resulting layout and import surface.

## `hooks`

| Hook | Signature | When |
|---|---|---|
| `afterEmit` | `(ctx) => void \| Promise<void>` | after files are written to disk; **skipped** on `--dry-run` / `tako validate` |

```ts
hooks: {
  afterEmit: async ({ /* … */ }) => {
    // e.g. run a formatter over the output
  },
}
```

## Validation

`loadConfig` runs, in order:

1. structural validation (a Valibot schema over the shape — `TakoConfigSchema`);
2. cross-field checks (mode-B requirements, duplicate generator names, unknown
   namespaces referenced by `generators[].namespaces`);
3. each parser's and generator's `options` against its own `optionsSchema`.

The first failure aborts with a located message. The precise schema is documented in the
[`@kurotako/config` API reference](../api/).
