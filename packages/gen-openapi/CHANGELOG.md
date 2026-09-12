# @kurotako/gen-openapi

## 0.2.0

### Minor Changes

- cdf127e: New package: the OpenAPI generator. Emits one OpenAPI 3.0/3.1 document
  (`components/schemas` only, no `paths`/operations) per namespace from the IR —
  entities, type aliases and enums, including relations (rendered nested via
  `$ref`, cross-source relations omitted) and a discriminated-union mapping
  symmetric to `@kurotako/parser-openapi`. Output is JSON or YAML, selectable via
  `options.format`.

### Patch Changes

- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
- Updated dependencies [22e6559]
  - @kurotako/ir@0.3.0
  - @kurotako/core@0.1.2
  - @kurotako/config@0.1.2
