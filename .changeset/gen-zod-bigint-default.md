---
'@kurotako/gen-zod': patch
---

Fix a `bigint` scalar field's literal default rendering as a quoted string
(`.default("0")`, causing TS2769 against `ZodBigInt`'s `default()`) instead
of an unquoted bigint literal (`.default(0n)`).
