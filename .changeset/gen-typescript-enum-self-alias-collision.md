---
'@kurotako/gen-typescript': patch
---

Fix `TypeScriptAliasPublicNameCollisionError` thrown for every named enum: a
parser's self-referencing alias entry for an enum (resolution metadata, not
a second declaration) is no longer treated as a collision, and is no longer
emitted into `aliases.ts`.
