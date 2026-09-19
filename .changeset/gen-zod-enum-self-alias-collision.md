---
'@kurotako/gen-zod': patch
---

Fix a duplicate-identifier compile error (`TS2440`) in `aliases.ts` for every
named enum: a parser's self-referencing alias entry for an enum (resolution
metadata, not a second declaration) is no longer emitted as a colliding
`export const <Name>Schema`, and no longer produces a phantom
`entities['<ns>.<enumName>']` artifact entry.
