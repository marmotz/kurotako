---
"@kurotako/ir": minor
---

Implement the IR model: Valibot schemas as the single source of truth
(`schemas.ts`), inferred type surface (`types.ts`), the `IR_VERSION` /
`isCompatible` version module, runtime validation with a cross-reference pass
(`validateIR` / `validateSourceIR` / `assertIR` / `parseIR`), traversal and
resolution helpers plus the shared-decision helpers (`isDbAssigned`,
`createFields`, `isCreateOptional`, `updateFields`, `scalarTsType`) in
`helpers.ts`, and the fluent `createSourceIR()` builder with
incremental validation (`builder.ts`). Adds `valibot` as the single runtime
dependency.
