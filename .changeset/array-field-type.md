---
'@kurotako/parser-openapi': minor
'@kurotako/gen-zod': minor
'@kurotako/gen-typescript': minor
'@kurotako/gen-angular': minor
'@kurotako/ir': minor
---

Add an `array` field type to the IR and bump the IR format to `'4'`.

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
