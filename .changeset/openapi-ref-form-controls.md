---
'@kurotako/gen-angular': patch
---

Fix reactive form generation for `FieldType.ref` / non-discriminated `union` fallback
fields (produced by `@kurotako/parser-openapi` from `$ref` payload properties): the
emitted interface member is now `FormControl<T | null>` and the control is seeded with
`null`, matching the type Angular's `FormControl` constructor actually produces for a
non-`nonNullable` control. Previously the interface declared `FormControl<T>` while the
`new FormControl<T>(...)` call resolved to `FormControl<T | null>`, so the generated
`*.form.ts` failed to type-check.
