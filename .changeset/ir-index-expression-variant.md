---
'@kurotako/ir': minor
---

`IndexDef` is now a discriminated union: `{ kind: 'columns', fields, name?, type? }`
or `{ kind: 'expression', expression, name?, type? }` — modeling an
expression-based index (e.g. a GIN index over `to_tsvector(...)`) as a
first-class alternative to a column-list index, instead of only supporting
column lists. `EntityBuilder.index(fields, opts)` now tags its result
`kind: 'columns'`; a new `EntityBuilder.indexExpression(expression, opts)`
builds the `kind: 'expression'` variant.

This is a breaking change to `IndexDef`: existing literals need the new
`kind` discriminant.
