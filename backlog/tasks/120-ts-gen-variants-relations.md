# backend — gen-typescript: variant field sets and relation families

**Statut** : à faire
**Type** : backend
**Issue** : [#120](https://github.com/marmotz/kurotako/issues/120)

Référence : [../features/generator-typescript/technical.md §Variant field sets](../features/generator-typescript/technical.md#variant-field-sets-rendervariantsts),
[§Relations](../features/generator-typescript/technical.md#relations-renderrelationsts--two-families).

## Constat vérifié

- [`packages/ir/src/helpers.ts`](../../packages/ir/src/helpers.ts) — shared-decision
  helpers `createFields(entity)`, `isCreateOptional(field)`, `updateFields(entity)`,
  `isDbAssigned(field)`; `isCrossSource(fromNs, rel)`.
- [`packages/gen-zod/src/render/variants.ts`](../../packages/gen-zod/src/render/variants.ts)
  — `variantFields(entity, variant)` delegates to those helpers; `filterClass(field)`
  maps a field to its Where operator class (`null` for `json` / `unknown`). Port both,
  dropping the Zod specifics.
- [`packages/gen-zod/src/render/relations.ts`](../../packages/gen-zod/src/render/relations.ts)
  — flat (returns `null`) vs deep; cross-source degrade to flat + `logger.debug(...)`
  with the message shape to mirror. `gen-typescript` names `<Target><Variant>DeepDto`
  directly — no `z.lazy`, no base split.
- [`Relation`](../../packages/ir/src/schemas.ts) — `{ name, target: { namespace, entity },
  cardinality: 'one' | 'many', optional, fkFields? }`.

## À faire

1. `src/render/variants.ts`: `variantFields(entity, variant)` (port), returning
   `{ field, optional }[]` for `full` / `create` / `update` / `where` / `select`;
   `filterClass(field)` (port) → `StringFilter` / `IntFilter` / `FloatFilter` /
   `BigIntFilter` / `DateTimeFilter` / `BoolFilter` / `Enum<Name>Filter` / `null`.
2. `src/render/relations.ts`:
   - `relationMember(rel, family, variant, { fromNamespace, logger })` → the member type
     string or `null` (flat, or cross-source degrade + `debug` log).
   - deep to-one → `<Target><Variant>DeepDto` (`?` if `rel.optional`); to-many →
     `<Target><Variant>DeepDto[]` (`?`).
   - `where` deep: to-one → `<Target>WhereDeepDto`; to-many →
     `{ some?: X; every?: X; none?: X }`.
   - `select` deep: `boolean | <Target>SelectDeepDto`.
   - track sibling entity names used, for the entity file's import block.
3. Tests: `create` drops the `expr`-default PK member and marks `isCreateOptional`
   fields `?`; `update` set omits the PK; `where`/`select` field sets; flat relation
   member is `null`; deep to-one/to-many member types; cross-source relation degrades
   to flat + `debug`.

## Dépendances

[119-ts-gen-scalars-jsdoc-field](119-ts-gen-scalars-jsdoc-field.md) — `render/field.ts`,
`render/scalars.ts`.
