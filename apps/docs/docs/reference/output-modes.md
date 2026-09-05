---
title: Output modes
sidebar_position: 4
---

# Output modes

Every `outputs` entry in [`tako.config.ts`](tako-config.md#outputs) picks a `mode`. Two
exist. The **import surface is identical** in both — only the location and packaging
differ.

## Layout common to both modes

Each generator owns the prefix `<namespace>/<generatorName>/` and writes its own barrel
there. `core` then synthesizes a `<namespace>/index.ts` that re-exports every generator
which contributed to that namespace.

```text
<root>/
  db/
    zod/
      user.schema.ts
      enums.ts
      index.ts          # gen-zod's own barrel
    angular/
      user.form.ts
      index.ts          # gen-angular's own barrel
    index.ts            # SYNTHESIZED by core: export * from './zod'; export * from './angular';
  index.ts              # SYNTHESIZED: re-exports every namespace
```

Import surface:

```ts
import { UserDto } from '@myapp/db';              // synthesized root barrel
import { UserSchema } from '@myapp/db/zod';       // one generator's barrel
import { UserSchema } from '@myapp/db/zod/user.schema'; // fine-grained, no eager sibling load
```

## Mode A — directory (default) {#mode-a}

`mode: 'dir'` (the default). The tree above is written under `dir`
(default `./generated/kurotako`), relative to the config file. You commit it — or add it
to `.gitignore` and regenerate in CI — and import it by relative path:

```ts
outputs: [{ dir: './generated/kurotako' }]
```

```ts
import { UserSchema } from './generated/kurotako/db/zod';
```

## Mode B — npm package per source {#mode-b}

`mode: 'package'`. Each namespace becomes its own installable npm package under
`packagesDir`, named `${scope}/${namespace}`. `tako` writes each package's `package.json`,
builds it, and auto-installs it into your workspace.

```ts
outputs: [
  {
    mode: 'package',
    packagesDir: './packages',
    scope: '@myapp',
    // packageManager: 'bun',  // optional — auto-detected
  },
]
```

`packagesDir` and `scope` are **required** for mode B; `loadConfig` fails without them.
The result is imported by package name:

```ts
import { UserSchema } from '@myapp/db/zod';
```

## Choosing

- **Mode A** is the default and the simplest: no build, no install, just files.
- **Mode B** suits a monorepo where the generated code is consumed like any other
  workspace package, with a real `package.json` and version.

The rationale is in
[`docs/architecture.md`](https://github.com/marmotz/kurotako/blob/develop/docs/architecture.md).
