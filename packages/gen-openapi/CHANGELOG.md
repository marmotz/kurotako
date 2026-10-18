# @kurotako/gen-openapi

## 0.4.0

### Minor Changes

- 147a177: New `read` variant (`UserReadSchema` / `UserReadDto`, plus `UserReadDeepSchema` / `UserReadDeepDto`) in `gen-zod` and `gen-typescript`, next to `full`, `create`, `update`, `where` and `select`. It is the shape of a stored row: fields that have a default (`id`, `createdAt`, ...) are required, and fields marked `hidden` are absent, nested relations included.
  
  `@kurotako/ir` adds `Field.hidden`, `FieldBuilder.hidden()`, `readFields` and `isReadOptional`. `@kurotako/parser-prisma` marks a field hidden from the new `hidden` option (`{ User: ['passwordHash'] }`, Prisma 7 and 8, an unknown entry is an error) or from a `/// @kurotako.hidden` doc annotation (Prisma 7 mode; a Prisma 8 contract carries no doc comments). `gen-openapi` leaves hidden fields out of `components/schemas`.
  
  `parser-prisma` also records ORM-generated defaults (`@default(uuid())`, `@updatedAt`, Prisma 8 generators) as expression defaults, so those fields read back as required, and keeps `format: 'time'` on `@db.Time` columns.

### Patch Changes

- Updated dependencies [147a177]
- Updated dependencies [147a177]
- Updated dependencies [147a177]
  - @kurotako/ir@0.7.0
  - @kurotako/core@0.4.0
  - @kurotako/config@0.2.1

## 0.3.0

### Minor Changes

- f58eccc: `openapiGenerator` now emits `<namespace>/<segment>/openapi.<ext>` and publishes the
  same module in its artifact from `ctx.segment` instead of a hardcoded `openapi`, so it
  can run as a private dependency of another generator. As a top-level generator the
  segment is still `openapi` and the output is unchanged.

### Patch Changes

- Updated dependencies [f58eccc]
- Updated dependencies [f58eccc]
- Updated dependencies [0ea85b1]
  - @kurotako/config@0.2.0
  - @kurotako/core@0.3.0
  - @kurotako/ir@0.6.0

## 0.2.3

### Patch Changes

- Updated dependencies [37a4e84]
  - @kurotako/ir@0.5.0
  - @kurotako/config@0.1.6
  - @kurotako/core@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [a3d63ef]
  - @kurotako/ir@0.4.0
  - @kurotako/config@0.1.5
  - @kurotako/core@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [69f41ac]
- Updated dependencies [69f41ac]
  - @kurotako/core@0.2.0
  - @kurotako/config@0.1.4

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
