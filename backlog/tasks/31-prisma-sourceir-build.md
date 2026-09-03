# backend — @kurotako/parser-prisma SourceIR assembly and end-to-end parse

**Status**: done **Type**: backend **Issue**: [#31](https://github.com/marmotz/kurotako/issues/31)

Reference: [../features/parser-prisma/technical.md §DMMF → `SourceIR` mapping (`map/`)](../features/parser-prisma/technical.md#dmmf--sourceir-mapping-map),
[§Cardinality, `optional`, `nullable`](../features/parser-prisma/technical.md#cardinality-optional-nullable),
[§Constraints, keys, indexes](../features/parser-prisma/technical.md#constraints-keys-indexes) and
[§Tests (vitest, colocated)](../features/parser-prisma/technical.md#tests-vitest-colocated).

## Verified

- `createSourceIR({ namespace, parser, parserVersion? })` fluent builder with incremental
  validation, `.build()` runs `assertSourceIR`
  ([ir-model/technical.md §Builder](../features/ir-model/technical.md#builder-builderts)).
- `core` calls `parse(ctx)` once per namespace then `validateSourceIR`
  ([core-pipeline/technical.md §Orchestration step 1](../features/core-pipeline/technical.md#orchestration-algorithm-runts)).
- Decided: `optional = hasDefaultValue || isUpdatedAt`; `nullable = !isRequired`; enums are
  source-level; `///` doc verbatim; `@@map` → `dbName`; field `@map` dropped (not in DMMF).

## To do

1. `packages/parser-prisma/src/map/build.ts`:
   - `export function buildSourceIR(namespace: string, model: PrismaModel, parserVersion: string): SourceIR`.
   - `const b = createSourceIR({ namespace, parser: 'prisma', parserVersion })`.
   - source-level enums from `model.enums` (`name`, `values` with `dbName`/`doc`, enum
     `dbName`/`doc`).
   - per entity: `field()` for each scalar/enum field — `mapFieldType` +
     `mapDefault`, `list` ← `isList`, `nullable` ← `!isRequired`,
     `optional` ← `hasDefaultValue || isUpdatedAt`, `unique` ← `isUnique`,
     `format` from `mapDefault`; `primaryKey(...)`, `unique([...])`, `index([...])`,
     `doc()`, `dbName()`.
   - relations from `buildRelations`, injecting `namespace` into every `target`; add the
     synthetic entities.
   - `return b.build()`.
2. Finalise `packages/parser-prisma/src/parser.ts` — real wiring, drop the stubs:
   `resolveInput` → `readDmmf` + `toPrismaModel` (mode 7) → `buildSourceIR`. Mode 8 throws
   a clear "not implemented in v1" error.
3. `packages/parser-prisma/src/parser.test.ts` — end-to-end fixture `schema.prisma`
   strings through `prismaParser.parse({ namespace: 'pg', cwd, logger }, { schema })`,
   asserting the returned `SourceIR` (structure, not a code snapshot):
   - scalars, native types, `optional`/`nullable` split, defaults;
   - single + composite `@id`, `@unique`, `@@unique`;
   - 1-1 / 1-n / explicit m2m / implicit m2m (synthetic entity);
   - `///` doc verbatim, `@@map` → `dbName`, field `@map` absent (documented gap);
   - multi-file `prisma/` folder merges into one `SourceIR`;
   - `validateSourceIR(result).ok === true` for every valid fixture;
   - determinism: parsing twice → deep-equal `SourceIR`, stable key order.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [29-prisma-scalar-mapping](29-prisma-scalar-mapping.md)
- [30-prisma-relation-mapping](30-prisma-relation-mapping.md)
