---
'@kurotako/gen-angular': patch
---

Fix a `bigint` `FormControl`'s literal default seeding as a quoted string
(`'0'`) instead of a bigint literal (`0n`), mismatching the control's
declared `FormControl<bigint>` type.
