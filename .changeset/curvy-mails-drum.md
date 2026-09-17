---
"@kurotako/parser-openapi": patch
---

Synthesize a name for an inline string enum found directly on an entity property (or on an array of that property), instead of falling back to `{ kind: 'unknown', hint: 'enum' }`.
