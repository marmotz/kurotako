---
'@kurotako/parser-prisma': patch
---

Stop crashing when a Prisma 8 `contract.json` table carries an
expression-based index (`@@index(expression: "...", ...)`, no `columns` —
e.g. a GIN full-text index). The index now reads into the IR's `expression`
`IndexDef` variant instead of failing contract validation on the missing
`columns` key.
