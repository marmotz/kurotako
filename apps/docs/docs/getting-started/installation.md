---
title: Installation
sidebar_position: 2
---

# Installation

## Requirements

- **Node.js >= 24.** The published packages run unmodified on **Node and on Bun** — no
  `Bun.*`-only APIs — so `tako` behaves identically under either runtime.
- A package manager: **npm, Bun, pnpm or Yarn**. Every install and `tako` command in
  these docs is shown with `npm`/`npx`; the Bun form (`bun add`, `bunx tako …`) works
  exactly the same, as do pnpm and Yarn. kurotako never shells out to a package manager
  during a normal `generate` (directory mode); it only needs one for
  [output mode B](../reference/output-modes.md#mode-b), where it auto-installs the
  generated packages (and picks Bun / pnpm / Yarn / npm automatically, or from
  `outputs[].packageManager`).

## Packages

kurotako is a set of small packages under the `@kurotako/*` scope. Nothing is bundled —
you install the CLI once, then add a parser and generators as your pipeline needs them.

### 1. The `kurotako` package (always)

| Package | Role |
|---|---|
| `kurotako` | the `tako` binary **and** `defineConfig`, in one install |

```bash
npm install -D kurotako
# bun add -d kurotako
# pnpm add -D kurotako
# yarn add -D kurotako
```

Your `tako.config.ts` then imports from it:

```ts
import { defineConfig } from 'kurotako';
```

The `tako` binary can also be installed globally (`npm install -g kurotako`,
`bun add -g kurotako`); `kurotako` still stays a project dev dependency because your
`tako.config.ts` imports it.

`kurotako` is an umbrella over `@kurotako/cli` (the binary) and `@kurotako/config`
(`defineConfig`), both pulled in transitively. Install those two directly only for
advanced use — the CLI's programmatic API (`runCli`, reporters) or the config loader
internals (`loadConfig`, `TakoConfigSchema`, error classes). `@kurotako/ir` and
`@kurotako/core` come in transitively too; depend on them directly only for programmatic
use (see the [API reference](../api/)).

### 2. One parser, per schema source

| Package | Schema source |
|---|---|
| `@kurotako/parser-prisma` | Prisma `schema.prisma` |

### 3. The generators you want output from

| Package | Output |
|---|---|
| `@kurotako/gen-zod` | Zod schemas |
| `@kurotako/gen-angular` | Angular types and typed `FormGroup`s (needs `gen-zod`) |

```bash
# Prisma in, Zod + Angular out:
npm install -D @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular
# bun add -d @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular

# Prisma in, Zod only:
npm install -D @kurotako/parser-prisma @kurotako/gen-zod
```

Install only what a given project uses. The full list is in the
[catalog](../reference/catalog.md).

## Adding a parser or a generator later

Every parser and generator is a separate package. To add one:

1. Install it: `npm install -D @kurotako/<package>` (or `bun add -d @kurotako/<package>`).
2. Import its exported parser or generator in `tako.config.ts`.
3. For a parser, add an entry under `sources` (its key is the
   [namespace](../concepts/namespaces.md)). For a generator, add an entry to the
   `generators` array — order does not matter, `core` resolves the
   [dependency graph](../concepts/dependency-graph.md).

Everything available is listed in the [catalog](../reference/catalog.md).

## Versioning

Packages are versioned independently (changesets). The documentation version selector
tracks `@kurotako/cli` (`tako`) releases: a docs version is "the docs as they stood for
`tako` vX".
