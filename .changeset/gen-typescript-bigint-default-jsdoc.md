---
'@kurotako/gen-typescript': patch
---

Render a `bigint` field's `@default` JSDoc tag as a bigint literal (`@default
0n`) instead of a quoted string (`@default "0"`), consistent with `gen-zod`
and `gen-angular`.
