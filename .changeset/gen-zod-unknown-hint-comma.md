---
'@kurotako/gen-zod': patch
---

Fixed a syntax error in generated code: an `unknown`-hint field's trailing `//
unknown[: hint]` comment now renders as a `/* ... */` block comment before the
comma instead of a line comment after it, so it no longer swallows the comma
when the field isn't an object's last property (previously a `tsc` `TS1005`
error).
