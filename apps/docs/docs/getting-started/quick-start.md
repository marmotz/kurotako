---
title: Quick start
sidebar_position: 1
---

# Quick start

This walkthrough installs `tako`, scaffolds a config, and runs a first generation from a
Prisma schema to Zod schemas and Angular form code.

A `tako.config.ts` has three parts: **`sources`** (what schema comes in, via a parser),
**`generators`** (what code comes out), and **`outputs`** (where that code is written and
how it is packaged). All three are covered below.

## 1. Install the CLI

`tako` needs **Node.js >= 24**. It runs unmodified on both Node and Bun, and installs
with any package manager. Install `@kurotako/cli` as a project dev dependency:

```bash
npm install -D @kurotako/cli
# bun add -d @kurotako/cli
# pnpm add -D @kurotako/cli
# yarn add -D @kurotako/cli
```

or globally, if you prefer a system-wide `tako`:

```bash
npm install -g @kurotako/cli
# bun add -g @kurotako/cli
```

## 2. Add the parser and generators you need

kurotako ships nothing built in. You pick one **parser** for your schema source and one
or more **generators** for the code you want out, and install only those packages. For
this walkthrough — a Prisma schema, Zod schemas and Angular forms:

```bash
npm install -D @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular
# bun add -d @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular
```

A React-only project would install `@kurotako/gen-zod` alone; a project with a different
schema source would swap `@kurotako/parser-prisma` for another parser. The full list is
in the [catalog](../reference/catalog.md).

The commands below use `npm`/`npx`; the Bun equivalents (`bun add`, `bunx tako …`) work
identically, as do pnpm and Yarn. See [Installation](installation.md) for details.

## 3. Scaffold the config

```bash
npx tako init
```

This writes a commented `tako.config.ts` in the current directory. It refuses to
overwrite an existing file — pass `--force` to replace it.

## 4. Edit `tako.config.ts`

Point a parser at your schema, list the generators to run, and declare where the result
goes:

```ts title="tako.config.ts"
import { defineConfig } from '@kurotako/config';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {
    // the config key is the namespace
    db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [
    { use: zodGenerator },
    { use: angularGenerator },
  ],
  outputs: [{ dir: './generated/kurotako' }],
});
```

- **`sources`** — one entry per schema. The key (`db`) is the
  [namespace](../concepts/namespaces.md): it isolates entities and names the output
  subtree, but never changes generated identifiers.
- **`generators`** — a set, not a sequence. `angularGenerator` declares
  `dependsOn: ['zod']`, so `core` runs `zod` first and hands it the artifact — you never
  order the array yourself. See the [dependency graph](../concepts/dependency-graph.md).
- **`outputs`** — a required array of destinations. Each entry has a `mode`:
  - **`mode: 'dir'`** (the default, used here) writes a plain directory tree under `dir`.
  - **`mode: 'package'`** writes one installable npm package per namespace and
    auto-installs it.

  You can list several destinations — for example a directory for local use *and* a
  package for publishing. The full shape (`dir`, `packagesDir`, `scope`,
  `packageManager`, per-destination `generators`) and the resulting file layout are in
  **[Output modes](../reference/output-modes.md)**.

## 5. Generate

```bash
npx tako generate
```

With the config above, the output lands under `./generated/kurotako/`, one subtree per
namespace and generator (`db/zod/…`, `db/angular/…`), plus a synthesized root barrel.
[Output modes](../reference/output-modes.md) walks through the layout and the
package-per-namespace alternative.

Useful flags:

- `tako generate --watch` — regenerate on every schema or config change.
- `tako generate --dry-run` — run every check and report how many files *would* be
  written, without touching disk.
- `tako validate` — the same checks as `generate` up to (not including) emission; a
  CI-friendly exit code.

## 6. Consume the output

Import the generated modules from your application code:

```ts
import { UserSchema } from './generated/kurotako';
```

Full command list: [CLI reference](../reference/cli.md). Full config shape:
[`tako.config.ts` reference](../reference/tako-config.md).
