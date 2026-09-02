# backend — @kurotako/gen-angular control-tree types and Create/Update variant field sets

**Status**: to do **Type**: backend **Issue**: [#39](https://github.com/marmotz/kurotako/issues/39)

Reference: [../features/generator-angular/technical.md §Control type per scalar](../features/generator-angular/technical.md#control-type-per-scalar-rendercontrolsts),
[§Variant field sets](../features/generator-angular/technical.md#variant-field-sets),
[§Enums](../features/generator-angular/technical.md#enums).

## Verified

- IR `ScalarType` = `string | boolean | int | bigint | float | decimal | date | datetime
  | uuid | bytes | json`; `FieldType` is `scalar | enum | unknown`
  ([ir-model/technical.md §Schemas and type surface](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)).
- `Field` carries `list`, `optional`, `nullable`, `constraints`, `default?: DefaultValue`;
  `Entity` carries `primaryKey?: string[]`; helper `primaryKeyFields(entity)` exists
  ([13-ir-traversal-helpers](13-ir-traversal-helpers.md)).
- The Create/Update field-set rules and the scalar → TS type mapping are `@kurotako/ir`
  shared-decision helpers (`createFields`, `isCreateOptional`, `updateFields`,
  `isDbAssigned`, `scalarTsType` —
  [ir-model/technical.md §Shared-decision helpers](../features/ir-model/technical.md#shared-decision-helpers-helpersts),
  task [#13](13-ir-traversal-helpers.md)). This task **consumes** them; `gen-zod` #34 calls
  the same functions, so agreement is by construction, not by matching two implementations.

## To do

1. `packages/gen-angular/src/render/controls.ts`:
   - `controlType(field: Field, zodEnumTypeName: (ref: string) => string): string` — the
     `FormControl<T>` type argument: base from `scalarTsType(field.type)` (`@kurotako/ir`),
     `enum` → the imported Zod union type name via `zodEnumTypeName`; wrap `T[]` when
     `field.list`, `T | null` when `field.nullable`.
   - `controlExpr(field, initExpr)` — `new FormControl(<init>, { nonNullable: true })` for
     a non-nullable field, `new FormControl<T | null>(<init> ?? null)` for a nullable one;
     initial value from a literal `DefaultValue.kind === 'value'` else the type's zero
     (`'' / 0 / false / null`); `expr` defaults seed nothing.
   - `controlsInterface(entity, variant, fields)` — emits
     `export interface <Entity><Variant>FormControls { … }` text.
2. `packages/gen-angular/src/render/variants.ts` (or a section of `controls.ts`):
   `variantFields(entity, variant): Field[]` — `Create` → `createFields(entity)`,
   `Update` → `updateFields(entity)`, both from `@kurotako/ir`. Control optionality from
   `isCreateOptional(field)`. No local field-selection or primary-key logic.
3. `packages/gen-angular/src/render/*.test.ts`:
   - every `ScalarType` → expected `FormControl<T>` arg; `nullable` → `T | null` +
     nullable control; non-nullable → `nonNullable: true`; `list` → `T[]`;
   - enum field → imported union type name, no re-declaration;
   - `Create` drops the `expr`-default primary key and seeds literal defaults; `Update`
     omits the primary key;
   - the emitted control set for a fixture equals the `gen-zod` variant field set for the
     same fixture.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [38-gen-angular-scaffold](38-gen-angular-scaffold.md)
- [13-ir-traversal-helpers](13-ir-traversal-helpers.md)
