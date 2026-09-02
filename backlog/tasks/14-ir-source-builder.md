# backend — SourceIR fluent builder

**Status**: done **Type**: backend **Issue**: [#14](https://github.com/marmotz/kurotako/issues/14)

Reference: [../features/ir-model/technical.md §Builder (`builder.ts`)](../features/ir-model/technical.md#builder-builderts).

## Verified

- Decided: fluent builder with incremental validation; `build()` runs the full
  `assertSourceIR` as the final gate (Valibot-backed since the IR is schema-first).

## To do

1. `packages/ir/src/builder.ts`:
   - `createSourceIR({ namespace, parser, parserVersion? }): SourceIrBuilder`.
   - `SourceIrBuilder`: `addEnum(name, def)`, `addEntity(name, def)`, `build()`.
   - `EntityBuilder`: `field`, `relation`, `localEnum`, `primaryKey`, `index`, `unique`,
     `doc`, `dbName`.
   - `FieldBuilder`: `scalar`, `enum`, `unknown`, `list`, `optional`, `nullable`,
     `primary`, `unique`, `min`/`max`/`minLength`/`maxLength`, `regex`, `format`,
     `default`, `doc`, `dbName`.
   - `RelationBuilder`: `to(namespace, entity)`, `one`, `many`, `optional`, `owning`,
     `backRelation`, `fkFields`, `references`, `onDelete`, `onUpdate`.
   - `EnumBuilder`: `value(name, opts?)`, `doc`, `dbName`.
2. Incremental checks that throw immediately with a located path: duplicate field name,
   `format()` on a non-string type, `primary()` on a `list` field, unknown `ScalarType`
   (checked against the `ScalarTypeSchema` picklist).
3. `build()` calls `assertSourceIR`; failure throws `IrBuildError` with the issue path.
4. `packages/ir/src/builder.test.ts` — the example from the technical design builds and
   deep-equals the expected `SourceIR`; each incremental-throw case; `build()` surfaces a
   downstream `assertSourceIR` failure (e.g. unresolved `backRelation`).
5. Add `builder.ts` to the `index.ts` barrel.
6. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [#11](11-ir-types-and-version.md)
- [#12](12-ir-runtime-validation.md)
