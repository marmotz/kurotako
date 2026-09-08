---
"@kurotako/gen-zod": minor
---

Union-type rendering. `baseExpr` emits a bare `<Name>Schema` forward reference
for a `ref` field type, `z.lazy(() => <Name>Schema)` only when that ref takes
part in a cycle (from `GenerateContext.cycles`), `z.union([...])` for a plain
union and `z.discriminatedUnion('<prop>', [...])` when a discriminator is set
(variants flattened; a degenerate union unfolds to its single variant). A new
`emit/aliases.ts` produces `<ns>/zod/aliases.ts` — aliases in topological order,
a non-recursive one re-using `z.infer`, a cyclic one hand-typed with a
`z.ZodType<<Name>>` annotation — one entry per `SourceIR.typeAliases`,
re-exported from the `<ns>/zod` barrel and surfaced in the generator artifact as
`entities['<ns>.<Name>']` (`module: <ns>/zod/aliases`,
`symbols: { schema, type }`). Entity fields carrying a `ref` / `union` type
import the referenced enum / alias / entity schemas.
