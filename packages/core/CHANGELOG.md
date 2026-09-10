# @kurotako/core

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
