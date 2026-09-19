---
'@kurotako/ir': minor
---

Add `nonRedundantTypeAliases(source)`, filtering out a parser's
self-referencing enum alias entries (`{ kind: 'enum', ref: <own name> }`) —
resolution metadata, not a second declaration — so every consumer of
`source.typeAliases` shares one shape-based definition of this invariant.
