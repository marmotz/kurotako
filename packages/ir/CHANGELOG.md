# @kurotako/ir

## 0.5.0

### Minor Changes

- 37a4e84: `IndexDef` is now a discriminated union: `{ kind: 'columns', fields, name?, type? }`
  or `{ kind: 'expression', expression, name?, type? }` — modeling an
  expression-based index (e.g. a GIN index over `to_tsvector(...)`) as a
  first-class alternative to a column-list index, instead of only supporting
  column lists. `EntityBuilder.index(fields, opts)` now tags its result
  `kind: 'columns'`; a new `EntityBuilder.indexExpression(expression, opts)`
  builds the `kind: 'expression'` variant.
  
  This is a breaking change to `IndexDef`: existing literals need the new
  `kind` discriminant.

## 0.4.0

### Minor Changes

- a3d63ef: Add `nonRedundantTypeAliases(source)`, filtering out a parser's
  self-referencing enum alias entries (`{ kind: 'enum', ref: <own name> }`) —
  resolution metadata, not a second declaration — so every consumer of
  `source.typeAliases` shares one shape-based definition of this invariant.

## 0.3.1

### Patch Changes

- 475fb0a: Add `defaultValueExpr(type, value)`, a shared helper rendering a field's
  literal default (`field.default.value`) as a source-code expression: a
  `bigint` scalar's default (always a numeric string on the IR) renders as an
  unquoted bigint literal (`"0"` -> `0n`), every other type via plain
  `JSON.stringify`.

## 0.3.0

### Minor Changes

- 9fe08b3: Add an `array` field type to the IR and bump the IR format to `'4'`.
  
  - `@kurotako/ir`: new `{ kind: 'array', element: FieldType }` field type, so an
    array-typed type alias, union variant or map value can be represented (the
    boolean `Field.list` fast path stays as an optimisation for a plain
    `property: { type: 'array', items: <scalar|ref> }`). Builders (`.array(...)`),
    validation, reference traversal, cycle analysis and TypeScript-type helpers
    recurse through it. The strict compatibility check now requires `irVersion` `'4'`.
  - `@kurotako/gen-zod`: renders an array as `z.array(<element>)` and its TS type as
    `<element>[]`.
  - `@kurotako/gen-typescript`: renders an array as `<element>[]`, parenthesising a
    union element.
  - `@kurotako/gen-angular`: renders an array field as `FormControl<<element>[]>`
    seeded with `[]`.
  - `@kurotako/parser-openapi`: an array schema that is not a plain object property
    (an array-typed response/component alias, a nested array, an array inside a
    `oneOf`/`additionalProperties`) now maps to the `array` field type instead of
    silently dropping the array wrapper. Nested arrays are supported.
- ecdb02c: Add the OpenAPI parser and IR typed maps.
  
  - `@kurotako/ir`: adds the `{ kind: 'map', value: FieldType }`
    field type and the optional `Entity.additionalProperties` slot. Builders,
    validation, reference traversal, cycle analysis and TypeScript-type helpers
    recurse through both.
  - `@kurotako/gen-zod`: renders map values as `z.record(z.string(), value)` and an
    entity catch-all as `.catchall(value)`.
  - `@kurotako/gen-typescript`: renders map values as `Record<string, Value>` and an
    entity catch-all as an index signature.
  - `@kurotako/gen-angular`: renders a map field as `FormControl<Record<string, Value>>`
    seeded with `{}`; entity-level catch-all values stay under the emitted Zod validator.
  - `@kurotako/parser-openapi`: new package. Turns an OpenAPI 3.0/3.1 document (local
    JSON/YAML or an unauthenticated HTTP(S) URL) into one `SourceIR`, mapping component
    and inline operation schemas to deterministic entities, aliases, enums and typed maps.

## 0.2.0

### Minor Changes

- 7a50439: IR union type support: `FieldType` gains `ref` and `union` kinds (recursive,
  `v.lazy`-wrapped schema, hand-written type), a `TypeAlias` registry
  (`SourceIR.typeAliases?`), the builder API (`f.ref`, `f.union` with
  `UnionBuilder`, `addTypeAlias`), resolution helpers (`resolveRef`,
  `resolveTypeAlias`, `iterTypeAliases`, `flattenUnion`) and an exhaustive
  `scalarTsType`. Validation walks field types recursively (`unresolved_ref`,
  `unresolved_type_alias`, `type_alias_key_mismatch`), tolerates degenerate
  unions and reference cycles through a new non-fatal `info` channel on
  `IrValidation` (`degenerate_union`, `union_cycle`).
  
  Bumps `IR_VERSION` from `1` to `2`; `isCompatible` stays strict equality, so a
  persisted `irVersion: '1'` dump is rejected with `version_incompatible`.

## 0.1.0

### Minor Changes

- First public release.
