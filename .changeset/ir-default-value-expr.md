---
'@kurotako/ir': patch
---

Add `defaultValueExpr(type, value)`, a shared helper rendering a field's
literal default (`field.default.value`) as a source-code expression: a
`bigint` scalar's default (always a numeric string on the IR) renders as an
unquoted bigint literal (`"0"` -> `0n`), every other type via plain
`JSON.stringify`.
