# @kurotako/core

## 0.2.3

### Patch Changes

- Updated dependencies [37a4e84]
  - @kurotako/ir@0.5.0

## 0.2.2

### Patch Changes

- Updated dependencies [a3d63ef]
  - @kurotako/ir@0.4.0

## 0.2.1

### Patch Changes

- 38b3da8: Fixed a `TS1205` error under `verbatimModuleSyntax`: the synthesized root
  barrel's collision re-export now emits `export type { X }` instead of
  `export { X }` when the winning declaration is a type (interface, type
  alias, or a generator's inferred `Dto` type), determined from the resolved
  TypeScript symbol rather than assumed to always be a value.

## 0.2.0

### Minor Changes

- 69f41ac: New exports `jsFile` and `jsIndex`: pure helpers that append `.js` (sibling file) or
  `/index.js` (sibling directory barrel) to a relative specifier. Generators use them to
  build relative import/export specifiers that satisfy `moduleResolution: node16`/`nodenext`,
  which requires an explicit extension on every relative specifier.

### Patch Changes

- 69f41ac: The synthesized root barrel (`<namespace>/index.ts`) now qualifies every re-export
  specifier with `/index.js` (`export * from './zod/index.js';` instead of
  `export * from './zod';`), so it compiles under `moduleResolution: node16`/`nodenext`. The
  mode-B `tsconfig.base.json` guidance no longer claims that setting requires
  `moduleResolution: bundler`.

## 0.1.3

### Patch Changes

- c1437da: Same root cause as the `parser-openapi`/`gen-typescript` fix (`fix-stale-ir-dependency-range`, `fix-lockfile-workspace-resolution`): every package published before the `bun.lock` / release-workflow fix still carries a stale internal dependency range from the drifted lockfile.
  
  - `@kurotako/core@0.1.2` and `@kurotako/config@0.1.2` declare `"@kurotako/ir": "^0.2.0"`. `@kurotako/core` is what actually runs IR validation during `tako generate` — with this stale range, its own nested `@kurotako/ir@0.2.0` copy gets resolved instead of `^0.3.0`, so `array`/`map` field types still fail validation even with `parser-openapi@0.2.2`/`gen-typescript@0.3.2` installed.
  - `@kurotako/parser-prisma@0.2.1`, `@kurotako/gen-zod@0.3.0` and `@kurotako/gen-angular@0.2.0` declare the same stale `"@kurotako/ir": "^0.2.0"`.
  - `@kurotako/cli@0.1.1` declares `"@kurotako/core": "^0.1.1"` / `"@kurotako/config": "^0.1.1"`, both below the packages' actual current versions.
  
  No source change needed anywhere (`workspace:^` already resolves correctly with the fixed release workflow); this changeset only forces the patch releases needed to publish corrected tarballs.

## 0.1.2

### Patch Changes

- 22e6559: Make the ambiguous root-barrel export warning understandable.
  
  - `@kurotako/core`: when several generators export identically-named
    declarations under one namespace, `synthesizeRootBarrels` now emits a single
    plain-language warning per namespace instead of one terse line per identifier.
    It says what caused the clash, that it is not an error, which import path
    yields which declaration, and how to silence it, plus a bounded deterministic
    sample of the affected names. The full per-identifier detail
    (`collisionCount`, `identifiers`, `sample`, `resolutions`) stays on the
    warning's structured meta object. The warning fires once from the aggregate
    tree rather than once per configured output, and the generated barrel content
    is unchanged.
  - `@kurotako/core`: `OutputNotGeneratedError` now explains the `"//"` marker and
    the two ways to unblock the path (delete the directory, or add the marker).
  - `@kurotako/cli`: `ConsoleReporter` prints the human-readable message at
    `info` / `warn` / `error` level and appends the structured `meta` object only
    with `--debug`. A custom `Logger` still receives `meta` in full, so default
    output stays prose instead of `key=value` noise.
- Updated dependencies [9fe08b3]
- Updated dependencies [ecdb02c]
  - @kurotako/ir@0.3.0

## 0.1.1

### Patch Changes

- 489a50d: Generated namespace root barrels now resolve overlapping public generator exports deterministically, so package declaration builds remain valid. The lexically first generator owns a colliding root export; every generator-specific subpath remains available.
- c575bc1: Integration of the IR union type. After merge, the non-fatal validation `info`
  channel (`union_cycle`, `degenerate_union`) is logged once at `warn`.
  `GenerateContext` gains `cycles: Set<string>` — the `${namespace}.${name}` of
  every entity / type alias that takes part in a `ref` cycle in the merged IR
  (from `@kurotako/ir`'s `refCycleMembers`) — so a generator can lazily wrap or
  widen a reference instead of relying on a local heuristic.
- Updated dependencies [7a50439]
  - @kurotako/ir@0.2.0

## 0.1.0

### Minor Changes

- First public release.

### Patch Changes

- Updated dependencies
  - @kurotako/ir@0.1.0
