# backend — @kurotako/gen-zod enums.ts and filters.ts emission

**Status**: to do **Type**: backend **Issue**: [#35](https://github.com/marmotz/kurotako/issues/35)

Reference: [../features/generator-zod/technical.md §File layout (decided: one file per entity + shared enums file)](../features/generator-zod/technical.md#file-layout-decided-one-file-per-entity--shared-enums-file),
[§Where operator schemas (decided: Prisma-style, `emit/filters.ts`)](../features/generator-zod/technical.md#where-operator-schemas-decided-prisma-style-emitfiltersts),
[§Naming (`names.ts`)](../features/generator-zod/technical.md#naming-namests--deterministic-never-namespace-prefixed).

## Verified

- Emitted files live under `<ns>/zod/` ([output-modes](../features/output-modes/technical.md)
  amendment); intra-source imports stay relative (`./enums`, `./filters`) so this task is
  unaffected beyond the output path.
- `EnumDef` = `{ name, values: EnumValue[], doc?, dbName? }`; enums are both source-level
  (`SourceIR.enums`) and entity-local (`Entity.enums`), entity-local resolved first
  ([ir-model/technical.md](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)).

## To do

1. `packages/gen-zod/src/emit/enums.ts`:
   `emitEnums(source: SourceIR, dialect): string` — for every reachable `EnumDef` (sorted
   by name, source-level + entity-local, de-duplicated): `export const X = [...] as const`,
   `export const XSchema = z.enum(X)`, `export type X = (typeof X)[number]`. Two distinct
   defs sharing a name → throw `ZodEnumCollisionError`.
2. `packages/gen-zod/src/emit/filters.ts`:
   `emitFilters(source: SourceIR, dialect): string` — emit only the operator schemas for
   scalar classes actually used: `StringFilter` (equals/not/in/notIn/lt/lte/gt/gte/
   contains/startsWith/endsWith), `IntFilter` / `FloatFilter` / `BigIntFilter` /
   `DateTimeFilter` (no string ops), `BoolFilter` (equals/not), `Enum<Name>Filter`
   (equals/not/in/notIn, imports the enum from `./enums`). All fields optional
   (`.partial()`).
3. `packages/gen-zod/src/emit/*.test.ts`:
   - enum const + schema + type; entity-local enum emitted; same-name distinct defs →
     `ZodEnumCollisionError`;
   - `filters.ts` emits only used classes; `Enum<Name>Filter` imports the enum;
     builders switch on `zodVersion`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [33-gen-zod-scalars-constraints](33-gen-zod-scalars-constraints.md)
