# @kurotako/gen-typescript

## 0.3.2

### Patch Changes

- be104bc: The previous fix (`@kurotako/parser-openapi@0.2.1`, `@kurotako/gen-typescript@0.3.1`) did not actually take effect: `bun.lock` had drifted from `package.json` (it still recorded `@kurotako/ir@0.2.0`, `@kurotako/core@0.1.1`, `@kurotako/config@0.1.1`), because `changeset version` bumps `package.json` and `CHANGELOG.md` but never refreshes the lockfile. `bun pm pack` resolves `workspace:^` from that lockfile, not from the live `package.json`, so the previously published tarballs still declared `"@kurotako/ir": "^0.2.0"`. `bun.lock` is now regenerated (`bun install`) and `.github/workflows/release.yml` runs `bun install` after `changeset version` so future "Version Packages" PRs carry a lockfile consistent with the bump.

## 0.3.1

### Patch Changes

- fac9c00: Fix a stale `@kurotako/ir` dependency range. The npm-published `@kurotako/parser-openapi@0.2.0` and `@kurotako/gen-typescript@0.3.0` declare `"@kurotako/ir": "^0.2.0"`, which excludes the `@kurotako/ir@0.3.0` release that shipped alongside them (the one adding the `array`/`map` field-type kinds and bumping the IR format to `'4'`). Both packages already require those kinds — an OpenAPI document with a top-level array response or an `additionalProperties` (map) schema fails IR validation when installed from npm today. Re-packing from the current source already resolves the workspace dependency to `^0.3.0`; this changeset only forces the patch release needed to publish that corrected tarball.

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

- 489a50d: Add a generator for pure TypeScript declaration types from kurotako IR.

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
