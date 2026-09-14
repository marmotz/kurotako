---
'@kurotako/core': patch
---

Fixed a `TS1205` error under `verbatimModuleSyntax`: the synthesized root
barrel's collision re-export now emits `export type { X }` instead of
`export { X }` when the winning declaration is a type (interface, type
alias, or a generator's inferred `Dto` type), determined from the resolved
TypeScript symbol rather than assumed to always be a value.
