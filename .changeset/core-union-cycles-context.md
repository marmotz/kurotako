---
"@kurotako/core": patch
---

Integration of the IR union type. After merge, the non-fatal validation `info`
channel (`union_cycle`, `degenerate_union`) is logged once at `warn`.
`GenerateContext` gains `cycles: Set<string>` — the `${namespace}.${name}` of
every entity / type alias that takes part in a `ref` cycle in the merged IR
(from `@kurotako/ir`'s `refCycleMembers`) — so a generator can lazily wrap or
widen a reference instead of relying on a local heuristic.
