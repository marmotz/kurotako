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
which contributed to that namespace, **except UI-framework generators** (`angular`,
`react-tanstack`): their output imports its framework as soon as it loads, so re-exporting
it would make a plain Node process (an API importing `@myapp/db`) require `@angular/forms`.
Those stay reachable from their own path, `@myapp/db/angular`.

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
    index.ts            # SYNTHESIZED by core: export * from './zod'; (angular is left out, see above)
  index.ts              # SYNTHESIZED: re-exports every namespace
```

Import surface:

```ts
import { UserDto } from '@myapp/db';              // synthesized root barrel
import { UserSchema } from '@myapp/db/zod';       // one generator's barrel
import { UserForm } from '@myapp/db/angular';     // UI-framework generators: this path only
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

The generated `package.json` declares an explicit `exports` entry for the package root and
for every generator that wrote into the namespace (`./zod`, `./typescript`, `./angular`, …),
each with `types`, `import` and `require` conditions, plus a `./*` pattern for single files
(`@myapp/db/zod/user.schema`). A sub-path such as `@myapp/db/zod` therefore resolves to the
generator's `dist/zod/index.*` for ESM, CommonJS and TypeScript alike. Before
`@kurotako/core` 0.4.0 (`kurotako` 0.3.0) only the `./*` pattern existed, which sent `@myapp/db/zod` to a non-existent
`dist/zod.js`; the workaround was `@myapp/db/zod/index`, which keeps working.

### Prerequisites {#mode-b-prerequisites}

`tako generate` checks these before writing anything, and reports everything that is
missing in a single error (with ready-to-paste content for the two files). The workspace
root is the directory **one level above `packagesDir`**.

- `tsconfig.base.json` in the workspace root. The generated `tsconfig.json` extends it.
  Minimal content: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`,
  `strict: true`, `skipLibCheck: true`.
- `tsup.config.base.{ts,js,mjs,cjs}` in the workspace root, exporting a `basePreset`
  (`tsup` `Options`: `format: ['esm', 'cjs']`, `dts` enabled, `outDir: 'dist'`). The
  generated `tsup.config.ts` spreads it.
- `typescript` resolvable from the workspace root (needed for the `.d.ts` build).
- Every peer dependency of the active generators resolvable from the generated package,
  that is, installed in the workspace root (or in `packagesDir`'s ancestors): `zod` for
  `gen-zod`, `@angular/core` and `@angular/forms` for `gen-angular`, and so on. Without
  them the `.d.ts` build fails with `TS2307` (cannot find module) followed by `TS7006`
  (implicit `any`).

To create the two base files, run `tako init --package-base` (add `--packages-dir <dir>`
if it is not `./packages`). It never overwrites an existing file. Install the
`typescript` and peer dependencies with your package manager.

### Bootstrapping a workspace that already depends on the generated package {#mode-b-bootstrap}

`tako generate` writes each package's `package.json` and then installs it into your
workspace for you — so on a project with no consumer yet, the very first `generate` just
works: nothing depends on `@myapp/db` until you add it.

A git-cloned monorepo is usually past that point: `apps/*/package.json` already declare
`"@myapp/db": "workspace:*"` so the app's own source can import it, and `packagesDir`
itself is gitignored (the package is fully regenerated, so committing its `dist`/`src`
would be redundant build output). That combination is a bootstrap deadlock for npm/Bun/pnpm
workspaces, independent of `tako`: `bun install` (or `npm`/`pnpm install`) resolves every
`workspace:*` reference in the graph up front, including `@myapp/db`, and refuses to
proceed while `packages/db/` doesn't exist yet — but nothing (not even `tako generate`) can
run before that same `install` has succeeded once, since it's what links `tako`'s own
binary into the project.

The fix is to commit a minimal stub `package.json` for the generated package — just enough
for the package manager's workspace resolution to find a name and version:

```json title="packages/db/package.json"
{
  "name": "@myapp/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "//": "Generated by tako. Do not edit."
}
```

The `"//"` value matters: it is the same marker `tako` looks for before wiping and
rewriting an output-package directory (`OutputNotGeneratedError` otherwise) — without it,
`tako generate` refuses to touch a non-empty directory it doesn't recognize as its own. With the stub in place, `bun install` resolves cleanly on a fresh
clone, `tako generate` runs, and immediately overwrites the stub with the real generated
`package.json` — which itself carries the same marker, so it stays a valid seed for the
next clone too. Everything else under `packages/db/` (`dist/`, `src/`, `tsup.config.ts`,
…) stays gitignored as before; only this one file needs the exception.

## Several generators in one namespace {#shared-entry-point}

When several generators describe the same model (for example `typescript`, `zod` and
`angular`), many declarations share a name (`UserDto`, `BoolFilter`, ...). The synthesized
`<namespace>` entry point can expose only one declaration per name, so it keeps the one
from the lexically first generator (usually `typescript`). Nothing is lost, and this is
not an error: `tako` only logs it at debug level (`--debug`). To get a specific
generator's declaration, import it explicitly:

```ts
import { UserDto } from '@myapp/db';            // typescript's declarations for clashing names
import { UserSchema } from '@myapp/db/zod';     // zod
import { UserForm } from '@myapp/db/angular';   // angular (never in the root entry point)
```

## Choosing

- **Mode A** is the default and the simplest: no build, no install, just files.
- **Mode B** suits a monorepo where the generated code is consumed like any other
  workspace package, with a real `package.json` and version.

The rationale is in
[`docs/architecture.md`](https://github.com/marmotz/kurotako/blob/develop/docs/architecture.md).
