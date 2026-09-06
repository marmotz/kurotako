# backend — gen-typescript: emit <Entity>.type.ts and the barrel

**Statut** : à faire
**Type** : backend
**Issue** : [#122](https://github.com/marmotz/kurotako/issues/122)

Référence : [../features/generator-typescript/technical.md §File layout](../features/generator-typescript/technical.md#file-layout--one-file-per-entity--shared-files),
[§IR -> TypeScript source-text mapping](../features/generator-typescript/technical.md#ir---typescript-source-text-mapping).

## Constat vérifié

- [`packages/gen-zod/src/emit/entity.ts`](../../packages/gen-zod/src/emit/entity.ts) —
  the per-entity emitter: 5 variants × 2 families, sorted import block, sibling tracking.
  Its header comment explains why `gen-zod` needs a base split + `z.ZodType` annotation
  (mutually inferred const initializers) — **`gen-typescript` does not**: mutually
  recursive `type` aliases emit a clean `.d.ts`.
- [`packages/gen-zod/src/emit/barrel.ts`](../../packages/gen-zod/src/emit/barrel.ts) —
  `emitBarrel(source)`: `export *` per file, valid even for an empty source.
- `verbatimModuleSyntax` is on ([`tsconfig.base.json`](../../tsconfig.base.json)) →
  cross-file imports are `import type { … } from '…'`.

## À faire

1. `src/emit/entity.ts`: `emitEntity(source, entity, logger)` →
   `<ns>/typescript/<Entity>.type.ts` text. For each `(variant, family)`:
   `export type <Name>Dto = { <members> };` (own scalar/enum members via
   `render/field.ts`, relation members via `render/relations.ts` for the deep family).
   - `update` → `Partial<{ <own members> }> & { <deep relation members> }`.
   - `where` → own filtered members + `AND?: <Dto> | <Dto>[]; OR?: …; NOT?: …` + deep
     relation members.
   - `select` → every scalar/enum field and relation as `?: boolean`
     (flat) / `?: boolean | <Target>SelectDeepDto` (deep).
   - Sorted import block: `import type { … } from './enums' | './filters' | './scalars' |
     './<Other>.type'`, specifier-sorted, names-sorted.
2. `src/emit/barrel.ts`: `emitBarrel(source)` → `<ns>/typescript/index.ts` —
   `export type *` / `export *` from `./scalars` (if emitted), `./enums`, `./filters`
   (if ≥ 1 entity), each `./<Entity>.type`. Valid for an empty source.
3. Tests: flat file references no `*DeepDto`; deep file names sibling `<Target>*DeepDto`
   directly; to-many → `<Target>DeepDto[]`; two mutually-referencing entities → the
   fixture output passes `tsc --noEmit`; `where`/`select`/`update` shapes; import block
   sorted; barrel re-exports every emitted file; empty source → valid `index.ts`.

## Dépendances

[120-ts-gen-variants-relations](120-ts-gen-variants-relations.md),
[121-ts-gen-emit-enums-filters](121-ts-gen-emit-enums-filters.md).
