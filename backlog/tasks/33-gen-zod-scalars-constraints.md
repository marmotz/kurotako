# backend — @kurotako/gen-zod scalar, constraint and field expression rendering

**Status**: to do **Type**: backend **Issue**: [#33](https://github.com/marmotz/kurotako/issues/33)

Reference: [../features/generator-zod/technical.md §Base scalar expression (`render/scalars.ts`, dialect-aware)](../features/generator-zod/technical.md#base-scalar-expression-renderscalarsts-dialect-aware),
[§Constraints (`render/constraints.ts`, dialect-aware)](../features/generator-zod/technical.md#constraints-renderconstraintsts-dialect-aware),
[§Field expression assembly (`render/field.ts`)](../features/generator-zod/technical.md#field-expression-assembly-renderfieldts).

## Verified

- IR `ScalarType` = `string | boolean | int | bigint | float | decimal | date | datetime
  | uuid | bytes | json`; `FieldType` is `scalar | enum | unknown`
  ([ir-model/technical.md §Schemas and type surface](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)).
- `Constraints` = `min | max | minLength | maxLength | regex | format | unique`;
  `StringFormat` is a closed union.
- `Field` carries `list`, `optional`, `nullable`, `constraints`, `default?: DefaultValue`.

## To do

1. `packages/gen-zod/src/render/scalars.ts`:
   `baseExpr(type: FieldType, dialect: ZodDialect): string` — scalar table (v3/v4 via
   `dialect`), `enum` → `` `${enumSchemaName(ref)}` ``, `unknown` → `z.unknown()` +
   `// unknown[: hint]` comment.
2. `packages/gen-zod/src/render/constraints.ts`:
   `applyConstraints(expr: string, c: Constraints, base: 'string' | 'number' | 'other',
   dialect): string` — fixed order `format` (string, replaces base in v4) → `min/maxLength`
   → `regex` (`new RegExp(<json-quoted>)`) → `min/max` (numeric). `unique` → no output.
3. `packages/gen-zod/src/render/field.ts`:
   `fieldExpr(field: Field, opts: { optional: boolean; variant: Variant }, dialect):
   string` — base + constraints, then `z.array(...)` if `list`, `.nullable()` if
   `nullable`, `.optional()` if `opts.optional`; in the `create` variant only,
   `.default(<json>)` for `DefaultValue.kind === 'value'`.
4. `packages/gen-zod/src/render/*.test.ts`:
   - every `ScalarType` → expected builder for `zodVersion` 4 and 3;
   - `format: 'email'` → `z.email()` (v4) vs `.email()` (v3); `minLength`/`maxLength` →
     `.min`/`.max`; `regex` → `.regex(new RegExp(...))`; numeric `min`/`max`; `unique` →
     nothing;
   - `nullable` → `.nullable()`; `list` → `z.array(...)`; literal default in `create` →
     `.default(v)`; `expr` default → no `.default()`.
5. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [32-gen-zod-scaffold](32-gen-zod-scaffold.md)
- [13-ir-traversal-helpers](13-ir-traversal-helpers.md)
