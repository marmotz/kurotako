---
'@kurotako/gen-openapi': minor
---

New package: the OpenAPI generator. Emits one OpenAPI 3.0/3.1 document
(`components/schemas` only, no `paths`/operations) per namespace from the IR —
entities, type aliases and enums, including relations (rendered nested via
`$ref`, cross-source relations omitted) and a discriminated-union mapping
symmetric to `@kurotako/parser-openapi`. Output is JSON or YAML, selectable via
`options.format`.
