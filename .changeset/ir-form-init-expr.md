---
'@kurotako/ir': minor
---

New pure helper `formInitExpr(field, enumZero?)` and its `EnumZero` type: the initial-value
expression of a form field (literal default, `[]` for a list / array, `null` for a nullable
field, else the type zero). A `ref` / non-discriminated `union` field yields `undefined`.
