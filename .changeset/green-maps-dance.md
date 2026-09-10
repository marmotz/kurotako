---
'@kurotako/parser-openapi': minor
'@kurotako/gen-zod': minor
'@kurotako/gen-typescript': minor
'@kurotako/gen-angular': minor
'@kurotako/ir': minor
---

Add the OpenAPI parser and IR typed maps.

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
