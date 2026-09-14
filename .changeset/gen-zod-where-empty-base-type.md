---
'@kurotako/gen-zod': patch
---

Fixed a `TS2322` error on `Where`/`WhereDeep` schemas for an entity with zero
own filterable fields (all relations, or all `unknown`-hint fields): the
`z.infer<typeof <name>Base>` member is no longer intersected into the `Dto`
type when the base object schema is empty, since Zod's inferred
`Record<string, never>` index signature for `z.object({})` made every
`AND`/`OR`/`NOT` property incompatible with it.
