---
title: Using tako in a monorepo
sidebar_position: 5
---

# Using tako in a monorepo

A consumer monorepo keeps one `tako.config.ts` at the workspace root, while the schema it
reads lives inside a sub-project (`libs/db`, `apps/backend`, …). `tako` supports this
layout directly: the schema-toolchain dependency (`@prisma/internals`) is resolved from
the directory the schema lives in, not from the repo root.

## Layout

```text
<repo>/
  package.json            # "workspaces": ["apps/*", "libs/*"]
  tako.config.ts          # the ONE config file
  libs/db/
    package.json          # devDependency: @prisma/internals
    prisma/schema.prisma
    src/generated/        # tako output for this sub-project
  apps/web/
    package.json
    src/generated/        # tako output for this sub-project
```

## `options.schema` is resolved against the config file

Every source path in `tako.config.ts` — `options.schema` for
[`@kurotako/parser-prisma`](catalog.md) — is resolved **relative to the config file's
directory**, i.e. the repo root, never relative to the schema's own package.

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';

export default defineConfig({
  sources: {
    // resolved from the repo root, where this file sits:
    db: { use: prismaParser, options: { schema: './libs/db/prisma/schema.prisma' } },
  },
  generators: [{ use: zodGenerator }],
  outputs: [
    { dir: './libs/db/src/generated', generators: ['zod'] },
    { dir: './apps/web/src/generated' },
  ],
});
```

## Where `@prisma/internals` goes

`@kurotako/parser-prisma` needs `@prisma/internals` (matching your Prisma major) to read
the schema. It is resolved from the **directory of `options.schema`**, walking up
`node_modules` from there through the repo root. So it can be a devDependency of the
sub-project that owns the schema:

```bash
# in libs/db/
npm install -D @prisma/internals
```

Hoisting it to the repo root still works (the walk-up reaches it), but it is no longer
required. If it cannot be resolved from either place, the parser fails with a
`prisma_peer_missing` error that spells out both options.

## One output per sub-project

Point each `outputs[]` entry at the sub-project that should receive that code, and narrow
it with the `generators` filter when a sub-project only wants a subset of generators. The
import surface written into each directory is the same regardless of location — see
[Output modes](output-modes.md).

## `tako init --monorepo`

`tako init` writes the monorepo skeleton when you pass `--monorepo`, or automatically when
it detects a workspace: it walks up to the nearest `package.json` and treats the project
as a monorepo when that file has a `workspaces` key (an array, or `{ packages: [...] }`)
or a `pnpm-workspace.yaml` sits beside it. `--no-monorepo` forces the single-project
skeleton. See the [CLI reference](cli.md#tako-init).
