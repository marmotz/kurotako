# Technical design: `.js`-qualified relative specifiers in generated output

See [`overview.md`](overview.md) for the decided scope and approach.

## Scope boundary

Only specifiers that are **written literally starting with `./`** by
generator/core code are in scope — these are the ones that resolve to a
sibling file on disk and trip TypeScript's `moduleResolution: nodenext`/
`node16` "relative import paths need explicit extensions" rule (`TS2835`).

Two other specifier shapes exist in the codebase and are **not** touched by
this fix:

- Bare package specifiers (`'zod'`, `'@angular/core'`, `'@angular/forms'`,
  `'@angular/forms/signals'`) — never relative, never need an extension.
- Namespace-qualified specifiers such as `` `${namespace}/typescript/${entity}.type` ``
  (built by `packages/gen-typescript/src/names.ts:65-87`'s `entityModule` /
  `enumsModule` / `filtersModule` / `scalarsModule` / `barrelModule`, and by
  `packages/gen-angular/src/render/{signal,reactive}.ts` for cross-entity form
  imports, e.g. `` `${namespace}/angular/${entity}.form` ``). These don't start
  with `.`, so TS's relative-extension rule doesn't apply to them; they resolve
  through the `paths` mapping mode B writes into each namespace package's
  `tsconfig.json` (`packages/core/src/writer/package.test.ts:108-110`:
  `{ 'pg/*': ['./src/*'] }`) or through mode A's documented consumer-side
  `tsconfig.json` `paths` alias. Whether that mechanism itself is fully
  `nodenext`-compatible is a separate question from this bug (its own
  reproduction and every location found only involves `./`-prefixed
  specifiers) — out of scope here.

## Shared helper — `@kurotako/core`

New module `packages/core/src/writer/specifier.ts`:

```ts
/** './aliases' -> './aliases.js'. For a specifier pointing at a sibling file. */
export function jsFile(specifier: string): string {
  return `${specifier}.js`;
}

/** './zod' -> './zod/index.js'. For a specifier pointing at a sibling directory's barrel. */
export function jsIndex(specifier: string): string {
  return `${specifier}/index.js`;
}
```

Exported from `packages/core/src/index.ts` alongside the existing
`synthesizeRootBarrels` export (`export { jsFile, jsIndex } from './writer/specifier.js';`).

No path arithmetic is needed: every call site already builds a flat,
same-directory `./name` string by hand (confirmed below) — there are no
`../` cases to resolve.

This is the first place a generator package imports a **runtime value**
(not just a type) from `@kurotako/core`. Each generator already carries
`@kurotako/core` as both a `peerDependency` and a `devDependency`
(`packages/gen-typescript/package.json`, same for `gen-zod`/`gen-angular`),
and `@kurotako/core` is always present at runtime (it's the orchestrator
that calls into every generator) — no `package.json` change needed, just
the new `import { jsFile } from '@kurotako/core';` (or `jsIndex`) alongside
the existing `import type { Logger } from '@kurotako/core';` lines.

## Call sites to update

### `packages/gen-typescript`

- `src/emit/entity.ts` — `importsFor()` (lines 34-49): wrap each
  `specifier` with `jsFile` before pushing (`'./aliases'`, `'./enums'`,
  `'./filters'`, `'./scalars'`, `` `./${entity}.type` ``).
- `src/emit/aliases.ts` — same shape, lines ~20-31 (`'./enums'`,
  `'./scalars'`, `` `./${ref}.type` ``).
- `src/emit/barrel.ts` — lines 10-17, each pushed line
  (`"export type * from './scalars';"` etc.) becomes
  `` `export type * from '${jsFile('./scalars')}';` `` and so on.
- `src/emit/filters.ts` — line ~116, the single `'./enums'` import when
  `enumNames.length > 0`.

### `packages/gen-zod`

- `src/emit/aliases.ts` — the `imports` array built at lines ~91-107
  (`'./enums'`, `` `./${ref}.schema` ``).
- `src/emit/entity.ts` — `buildImports()` (lines 400-442): `'./enums'`,
  `'./aliases'`, `'./filters'`, `` `./${target}.schema` ``.
- `src/emit/barrel.ts` — lines 10-20 (`"./enums"`, `"./filters"`,
  `"./aliases"`, `` `./${entity.name}.schema` ``).
- `src/emit/filters.ts:116` — the single `'./enums'` import.

### `packages/gen-angular`

- `src/emit/barrel.ts` — lines 17/20: `"./zod-forms.runtime"` and
  `` `./${entity.name}.form` ``. This is the only place in `gen-angular`
  that builds a `./`-prefixed specifier — `render/signal.ts` and
  `render/reactive.ts` use the namespace-qualified form for the same
  targets (see Scope boundary above) and are unaffected.

### `packages/core`

- `src/writer/barrel.ts:40` — `` generators.map((name) => `export * from './${name}';`) ``
  becomes `` generators.map((name) => `export * from '${jsIndex(`./${name}`)}';`) ``
  (directory target: each generator owns `<namespace>/<generatorName>/index.ts`,
  so this needs `/index.js`, not `.js`).
- `src/writer/barrel.ts:43` (collision re-export) — same treatment:
  `` `export { ${identifier} } from '${jsIndex(`./${owners[0]}`)}';` ``.
- `exportedNameCollisions()` (lines 158-216) is unaffected: it feeds raw
  in-memory source text straight to the TypeScript compiler host by exact
  file name (`toVirtualPath`), never through a resolved `import`/`export`
  specifier, so it doesn't go through the extension-resolution path at all.

## `core/src/errors.ts` doc update

`MISSING_PACKAGE_WORKSPACE_FILE_GUIDANCE['tsconfig.base.json']`
(lines 180-195) currently tells mode-B workspace-package consumers to pin
`"moduleResolution": "bundler"` specifically because `node16`/`nodenext`
"would fail to compile the extensionless `export * from './zod';`". Once
barrels emit `.js`-qualified specifiers, that reason no longer holds.

Update the trailing paragraph (lines 192-195) to drop the extensionless-barrel
justification. Keep `"moduleResolution": "bundler"` as the suggested default
value in the example block (still the lowest-friction choice for a
`tsup`-built package with no consumer-facing constraint forcing `nodenext`),
but rephrase the note so it no longer claims `node16`/`nodenext` "would
fail" — e.g.: replace the note with something like "`node16`/`nodenext` also
works against tako's generated output now; `bundler` is suggested here as
the simpler default for a package built with `tsup`." Exact wording is an
implementation-time call, not a product decision — no test asserts the
warning text itself (`errors.test.ts:66` only checks
`'"moduleResolution": "bundler"'` is present, which stays true).

## Test impact

Every emit function has string-literal assertions on its exact output
(`toBe`/`toContain` on lines like `"export * from './enums';\n"`) across:

- `packages/gen-typescript/src/emit/{entity,aliases,barrel,filters}.test.ts`
- `packages/gen-zod/src/emit/{entity,aliases,barrel,filters}.test.ts` and
  `aliases.compile.test.ts`
- `packages/gen-angular/src/emit/barrel.test.ts`
- `packages/core/src/writer/barrel.test.ts` and `run.test.ts` (root-barrel
  content assertions, e.g. lines 23/30/52/62/93/122/164/181/187)

All of these need their expected specifier strings updated to the
`.js`/`/index.js`-qualified form as part of implementation — per
[`AGENTS.md`](../../../../AGENTS.md) "every implementation ships with its test
changes", not optional follow-up.

`errors.test.ts:66` (`MissingPackageWorkspaceFilesError` guidance test) only
needs to keep passing — no new assertion required unless the task wants to
also pin the updated wording.

## Découpage en tâches d'implémentation

1. [#154](https://github.com/marmotz/kurotako/issues/154) — core: add `jsFile`/`jsIndex` helper for extension-qualified relative specifiers.
2. [#155](https://github.com/marmotz/kurotako/issues/155) — core: qualify synthesized root barrel specifiers with `jsIndex`, update mode-B tsconfig guidance. Depends on #154.
3. [#156](https://github.com/marmotz/kurotako/issues/156) — gen-typescript: qualify emitted relative specifiers with `jsFile`. Depends on #154.
4. [#157](https://github.com/marmotz/kurotako/issues/157) — gen-zod: qualify emitted relative specifiers with `jsFile`. Depends on #154.
5. [#158](https://github.com/marmotz/kurotako/issues/158) — gen-angular: qualify emitted relative barrel specifiers with `jsFile`. Depends on #154.
