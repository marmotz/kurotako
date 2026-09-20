---
'@kurotako/gen-angular': patch
---

Internal refactor: the control initial-value logic now comes from the shared
`formInitExpr` helper of `@kurotako/ir`. No change to the generated output.
