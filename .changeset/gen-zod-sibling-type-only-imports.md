---
'@kurotako/gen-zod': patch
---

Fixed a `TS1484` error under `verbatimModuleSyntax`: a sibling entity's `Dto`
type name is now imported with a `type` prefix (`import { XSchema, type
XDto } from './X.schema.js';`) instead of being mixed in untyped with the
schema-const name it shares an import statement with.
