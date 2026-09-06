# backend — @kurotako/gen-typescript scaffold, names and errors

**Statut** : à faire
**Type** : backend
**Issue** : [#118](https://github.com/marmotz/kurotako/issues/118)

Référence : [../features/generator-typescript/technical.md §Package shape](../features/generator-typescript/technical.md#package-shape),
[§Public contract](../features/generator-typescript/technical.md#public-contract-generatorts),
[§Naming](../features/generator-typescript/technical.md#naming-namests--reuse-the-gen-zod-matrix-dto-half-only).

## Constat vérifié

- `packages/` has no `gen-typescript/` yet — the package is created from scratch.
- [`packages/gen-zod/package.json`](../../packages/gen-zod/package.json) is the shape to
  copy (name, `exports`, `files`, `publishConfig`, `engines`, `@kurotako/ir` in
  `dependencies`, `core`/`config` in peer + dev). `gen-typescript` drops `valibot` (no
  options in v1).
- [`packages/gen-zod/tsconfig.json`](../../packages/gen-zod/tsconfig.json) — `references`
  to `../ir`, `../core`, `../config`.
- [`packages/gen-zod/tsup.config.ts`](../../packages/gen-zod/tsup.config.ts) /
  [`vitest.config.ts`](../../packages/gen-zod/vitest.config.ts) — one-liners to mirror.
- Root [`tsconfig.json`](../../tsconfig.json) lists every package under `references`;
  root [`vitest.config.ts`](../../vitest.config.ts) auto-discovers
  `packages/*/vitest.config.ts` (no edit needed there).
- [`packages/gen-zod/src/names.ts`](../../packages/gen-zod/src/names.ts) —
  `VARIANTS` / `FAMILIES` / `VARIANT_TOKEN` / `FAMILY_TOKEN` / `typeName(entity, variant,
  family)` to copy; `Schema`-side helpers are dropped.
- [`packages/gen-zod/src/errors.ts`](../../packages/gen-zod/src/errors.ts) —
  `ZodGenError` / `ZodEnumCollisionError` pattern.
- [`defineGenerator`](../../packages/config/src/define-driver.ts) accepts a call with no
  `optionsSchema` (generic defaults to `undefined`).

## À faire

1. `packages/gen-typescript/package.json`: copy `gen-zod`'s, swap
   name/description/keywords/`repository.directory`; `dependencies`: `@kurotako/ir`
   (`workspace:^`) only; `peerDependencies` + `devDependencies`: `@kurotako/core` +
   `@kurotako/config` (`workspace:^`). No `valibot`. `"sideEffects": false`.
2. `packages/gen-typescript/tsconfig.json`: extend `../../tsconfig.base.json`,
   `references` to `../ir`, `../core`, `../config`.
3. `tsup.config.ts` (`export { basePreset as default } from '../../tsup.config.base'`),
   `vitest.config.ts` (`test.name: 'gen-typescript'`, `include: ['src/**/*.test.ts']`).
4. Root `tsconfig.json`: add `{ "path": "packages/gen-typescript" }` to `references`.
5. `src/errors.ts`: `TypeScriptGenError extends Error { code }` base +
   `TypeScriptEnumCollisionError` (`code: 'typescript_enum_collision'`, names both origins).
6. `src/names.ts`: port `VARIANTS` / `FAMILIES` / `VARIANT_TOKEN` / `FAMILY_TOKEN` /
   `typeName(entity, variant, family)` (`${Entity}${Variant}${Family}Dto`); module
   specifiers `entityModule(ns, e)` (`` `${ns}/typescript/${e}.type` ``),
   `enumsModule(ns)`, `filtersModule(ns)`, `scalarsModule(ns)`, `barrelModule(ns)`
   (all `${ns}/typescript[/...]`); `enumConst(name)` / `enumTypeName(name)`.
7. `src/generator.ts`: `typescriptGenerator = defineGenerator({ name: 'typescript',
   generate(ctx) { /* empty GenOutput for now */ } })`.
8. `src/index.ts`: barrel — `typescriptGenerator`, `TypeScriptArtifactExtra` (type
   placeholder), error classes.
9. `src/*.test.ts`: `names.ts` matrix (every variant × family), `errors.ts`.
10. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dépendances

Aucune. (`@kurotako/ir`, `@kurotako/core`, `@kurotako/config` are already shipped.)
