# @kurotako/core

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
