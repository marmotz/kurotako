# backend — IR runtime validation (Valibot + cross-reference pass)

**Status**: to do **Type**: backend **Issue**: [#12](https://github.com/marmotz/kurotako/issues/12)

Reference: [../features/ir-model/technical.md §Runtime validation (`validate.ts`)](../features/ir-model/technical.md#runtime-validation-validatets).

## Verified

- Decided: schema-first on Valibot. Structural shape / closed-union membership /
  tagged-union narrowing come from `schemas.ts` (#11); this task adds the parse wrapper
  and the cross-reference checks Valibot cannot express. See the technical design
  "Alternatives considered".

## To do

1. `packages/ir/src/validate.ts`:
   - `IrIssue { path; code; message }`, `IrIssueCode` union, `IrValidation<T>`,
     `IrValidationError`.
   - `validateSourceIR(value): IrValidation<SourceIR>` — `v.safeParse(SourceIrSchema, …)`
     then the cross-ref checks that do not need the cross-namespace view.
   - `validateIR(value): IrValidation<IR>` — `v.safeParse(IrSchema, …)` then the full
     cross-ref set, post-merge.
   - `assertIR` / `assertSourceIR` — throw `IrValidationError` carrying the issues.
   - `parseIR(json: string): IR` — `JSON.parse` then `assertIR`.
   - Normalise Valibot issues (`issue.path` → dotted string, map to an `IrIssueCode`,
     default `shape`) and cross-ref issues into one `IrIssue[]`.
2. Cross-reference pass (Valibot handles the rest): unresolved enum ref (entity-local
   then source-level), `primaryKey` / `indexes` / `uniques` / `fkFields` / `references`
   field references, relation `target` resolution (same-namespace hard,
   other-namespace-present hard, namespace-absent = informational), `backRelation`
   existence, `min<=max`, `minLength<=maxLength`, `regex` compiles via `new RegExp`,
   `irVersion` compatible, key/name mismatch (`sources[k].namespace === k`,
   `entities[k].name === k`, `enums[k].name === k`).
3. Paths in issues are dotted and located (`pg.User.email`, `pg.User.relations.posts`).
4. `packages/ir/src/validate.test.ts` — one valid baseline IR fixture + one failing
   fixture per `IrIssueCode`; assert `parseIR(JSON.stringify(ir))` round-trips equal.
5. Add `validate.ts` to the `index.ts` barrel.
6. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [#11](11-ir-types-and-version.md)
