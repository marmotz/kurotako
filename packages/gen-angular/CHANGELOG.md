# @kurotako/gen-angular

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

- 0c8e725: Fix reactive form generation for `FieldType.ref` / non-discriminated `union` fallback
  fields (produced by `@kurotako/parser-openapi` from `$ref` payload properties): the
  emitted interface member is now `FormControl<T | null>` and the control is seeded with
  `null`, matching the type Angular's `FormControl` constructor actually produces for a
  non-`nonNullable` control. Previously the interface declared `FormControl<T>` while the
  `new FormControl<T>(...)` call resolved to `FormControl<T | null>`, so the generated
  `*.form.ts` failed to type-check.
- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
- Updated dependencies [22e6559]
  - @kurotako/gen-zod@0.3.0
  - @kurotako/ir@0.3.0
  - @kurotako/core@0.1.2
  - @kurotako/config@0.1.2

## 0.2.0

### Minor Changes

- da7dd32: Union-type control support. A `{ kind: 'ref' }` field now types its control as
  the Zod-emitted DTO / alias name (`FormControl<AddressDto>`); a non-discriminated
  `union` types as the variant types joined (`FormControl<string | number>`), a branch whose ref is
  in `GenerateContext.cycles` widening the control to `unknown`. Both fallback
  controls carry a `// union: validated by zodValidator(schema)` note and a
  `logger.warn`.
  
  A **discriminated** union field (`discriminator.mapping` set, every target an
  entity in the same source) becomes a nested `FormGroup` holding a discriminator
  `FormControl` plus one `FormGroup<<Variant>FormControls>` per discriminator
  value, built by delegating to the target entity's injected `FormFactory`. A new
  runtime helper `switchDiscriminatedGroup` toggles the active sub-group on the
  discriminator control's `valueChanges` and rewrites the group's `getRawValue()`
  to the flat active-variant shape a root `z.discriminatedUnion` schema can parse.
  
  A `{ kind: 'ref' }` field whose target is an alias resolves its type through the
  Zod artifact's alias entry; `gen-angular` itself adds no alias entry to its own
  artifact (aliases produce no Angular form and `gen-zod`'s `<ns>/zod/aliases.ts`
  is the single exporter — re-declaring them would make the root-barrel ambiguity
  check flag a phantom conflict).

### Patch Changes

- Updated dependencies [489a50d]
- Updated dependencies [c575bc1]
- Updated dependencies [6307397]
- Updated dependencies [7a50439]
  - @kurotako/core@0.1.1
  - @kurotako/gen-zod@0.2.0
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
  - @kurotako/gen-zod@0.1.0
