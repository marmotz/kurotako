# backend — @kurotako/gen-zod variant derivation and relation families

**Status**: done **Type**: backend **Issue**: [#34](https://github.com/marmotz/kurotako/issues/34)

Reference: [../features/generator-zod/technical.md §Variant field sets (`render/variants.ts`)](../features/generator-zod/technical.md#variant-field-sets-rendervariantsts),
[§Relations (`render/relations.ts`) — two families (decided)](../features/generator-zod/technical.md#relations-renderrelationsts--two-families-decided).

## Verified

- `Relation` carries `cardinality: 'one' | 'many'`, `optional`, `owning`, `fkFields?`,
  `target: { namespace, entity }`; `isCrossSource(fromNs, rel)` and `primaryKeyFields`
  are `@kurotako/ir` helpers
  ([ir-model/technical.md §Helpers](../features/ir-model/technical.md#helpers-helpersts)).
- FK backing columns stay ordinary `Field`s referenced by `relation.fkFields`.
- **The `create` / `update` field selection is `@kurotako/ir`'s job**, not this task's:
  `createFields`, `isCreateOptional`, `updateFields`, `isDbAssigned`
  ([ir-model/technical.md §Shared-decision helpers](../features/ir-model/technical.md#shared-decision-helpers-helpersts),
  task [#13](13-ir-traversal-helpers.md)). `render/variants.ts` calls them; it must not
  re-encode the rule (`gen-angular` #39 calls the same helpers).

## To do

1. `packages/gen-zod/src/render/variants.ts`:
   `variantFields(entity: Entity, variant: Variant): { field: Field; optional: boolean }[]`
   - `full`: all scalar/enum fields, `optional` from `field.optional`.
   - `create`: `createFields(entity)` from `@kurotako/ir`; `optional` from
     `isCreateOptional(field)`.
   - `update`: `updateFields(entity)` from `@kurotako/ir`, whole object `.partial()`.
   - `where`: all scalar/enum fields, each wrapped in its filter schema, all optional; add
     `AND` / `OR` / `NOT`.
   - `select`: all scalar/enum fields **and** relations, `z.boolean().optional()` (flat) /
     `z.union([z.boolean(), z.lazy(() => <Target>SelectSchema)]).optional()` (deep).
2. `packages/gen-zod/src/render/relations.ts`:
   `relationExpr(rel: Relation, family: 'flat' | 'deep', variant: Variant, dialect):
   string | null` — flat → `null` (FK field already emitted); deep → `z.lazy(() =>
   <Target><Variant>DeepSchema)`, `.optional()` if `rel.optional`, wrapped in `z.array`
   for `many`. `isCrossSource` → return `null` (degrade to FK id) + `logger.debug`.
3. `packages/gen-zod/src/render/*.test.ts`:
   - `create` drops the `expr`-default PK; `update` is `.partial()` without PK; `where`
     wraps fields + adds `AND/OR/NOT`; `select` all-boolean (flat) / boolean-or-lazy (deep);
   - deep to-one → `z.lazy`, to-many → `z.array(z.lazy(...))`; cross-source relation → `null`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [33-gen-zod-scalars-constraints](33-gen-zod-scalars-constraints.md)
- [13-ir-traversal-helpers](13-ir-traversal-helpers.md) — `createFields` / `isCreateOptional` / `updateFields`
