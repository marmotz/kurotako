# backend — @kurotako/parser-prisma relation pairing and implicit-m2m materialisation

**Status**: to do **Type**: backend **Issue**: [#30](https://github.com/marmotz/kurotako/issues/30)

Reference: [../features/parser-prisma/technical.md §Relations (`map/relations.ts`)](../features/parser-prisma/technical.md#relations-maprelationsts) and
[§Implicit many-to-many — materialised (`map/relations.ts`)](../features/parser-prisma/technical.md#implicit-many-to-many--materialised-maprelationsts).

## Verified

- IR `Relation` carries `name`, `target { namespace, entity }`, `cardinality`, `optional`,
  `owning`, `backRelation?`, `fkFields?`, `references?`, `onDelete?`, `onUpdate?`
  ([ir-model/technical.md §Schemas and type surface](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)).
- `PrismaRelationEdge` (from the dmmf-reader task) already exposes `relationName`,
  `targetEntity`, `isList`, `isRequired`, `fromFields`, `toFields`, `onDelete`, `onUpdate`.
- Decided: implicit m2m is materialised as a readable synthetic entity (`${A}${B}` sorted,
  or the `@relation` name; `<model>Id` FK fields; composite PK); the two originals are
  rewritten to `many` at the synthetic entity.

## To do

1. `packages/parser-prisma/src/map/relations.ts`:
   - `export function buildRelations(model: PrismaModel): { relations: Map<string, Relation[]>; syntheticEntities: SyntheticEntity[] }`
     keyed by entity name.
   - Group edges by `relationName`. For a normal pair:
     - owning side = `fromFields.length > 0` → `fkFields = fromFields`,
       `references = toFields`, `owning: true`;
     - `cardinality = isList ? 'many' : 'one'`; `optional = !isRequired`;
     - `backRelation` = the other edge's `fieldName`;
     - `onDelete` / `onUpdate` mapped `Cascade→cascade`, `Restrict→restrict`,
       `SetNull→setNull`, `SetDefault→setDefault`, `NoAction→noAction`;
     - `target = { namespace: <ctx>, entity: targetEntity }` (namespace injected in
       `build.ts`; pass a placeholder / resolve later).
   - Implicit m2m detection: both edges `isList` and `fromFields.length === 0 &&
     toFields.length === 0`. Materialise:
     - name: the `@relation("…")` name when set and not the default `"AToB"` form; else
       `` `${x}${y}` `` with `[x, y] = [A, B].sort()`;
     - fields `` `${lcfirst(x)}Id` `` / `` `${lcfirst(y)}Id` ``, scalar = the referenced
       entity's PK scalar (fallback `string`, `logger.debug`);
     - `primaryKey` = both FK fields;
     - two `one` relations synthetic→A, synthetic→B, `owning: true`, `fkFields` set,
       `references` = target PK, `onDelete: 'cascade'`;
     - rewrite the two original edges to `many` relations at the synthetic entity,
       `owning: false`, `backRelation` → the matching synthetic-side relation name.
2. `packages/parser-prisma/src/map/relations.test.ts` (fixtures via the dmmf-reader):
   - 1-1 and 1-n: owning side has `fkFields`/`references`, other has `backRelation`;
   - `onDelete: Cascade` → `cascade`; optional to-one → `optional: true`;
   - explicit m2m (join model present) → two ordinary 1-n relations, no synthetic entity;
   - implicit m2m → synthetic entity with sorted `${A}${B}` name, `<model>Id` fields,
     composite PK, two owning `one` relations; originals rewritten to `many`;
   - `@relation("Membership")` on an implicit m2m → synthetic entity named `Membership`.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [28-prisma-dmmf-reader](28-prisma-dmmf-reader.md)
- [29-prisma-scalar-mapping](29-prisma-scalar-mapping.md)
