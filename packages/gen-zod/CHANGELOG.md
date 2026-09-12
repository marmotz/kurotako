# @kurotako/gen-zod

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

### Patch Changes

- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
- Updated dependencies [22e6559]
  - @kurotako/ir@0.3.0
  - @kurotako/core@0.1.2
  - @kurotako/config@0.1.2

## 0.2.0

### Minor Changes

- 6307397: Union-type rendering. `baseExpr` emits a bare `<Name>Schema` forward reference
  for a `ref` field type, `z.lazy(() => <Name>Schema)` only when that ref takes
  part in a cycle (from `GenerateContext.cycles`), `z.union([...])` for a plain
  union and `z.discriminatedUnion('<prop>', [...])` when a discriminator is set
  (variants flattened; a degenerate union unfolds to its single variant). A new
  `emit/aliases.ts` produces `<ns>/zod/aliases.ts` — aliases in topological order,
  a non-recursive one re-using `z.infer`, a cyclic one hand-typed with a
  `z.ZodType<<Name>>` annotation — one entry per `SourceIR.typeAliases`,
  re-exported from the `<ns>/zod` barrel and surfaced in the generator artifact as
  `entities['<ns>.<Name>']` (`module: <ns>/zod/aliases`,
  `symbols: { schema, type }`). Entity fields carrying a `ref` / `union` type
  import the referenced enum / alias / entity schemas.

### Patch Changes

- Updated dependencies [489a50d]
- Updated dependencies [c575bc1]
- Updated dependencies [7a50439]
  - @kurotako/core@0.1.1
  - @kurotako/ir@0.2.0
  - @kurotako/config@0.1.1

## 0.1.0

### Minor Changes

- First public release.

### Patch Changes

- Updated dependencies
  - @kurotako/ir@0.1.0
  - @kurotako/core@0.1.0
  - @kurotako/config@0.1.0
