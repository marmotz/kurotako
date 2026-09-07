---
"@kurotako/gen-zod": minor
---

Union-type rendering. `baseExpr` now emits `z.lazy(() => <Name>Schema)` for a
`ref` field type, `z.union([...])` for a plain union, and
`z.discriminatedUnion('<prop>', [...])` when a discriminator is set (variants
flattened; a degenerate union unfolds to its single variant). A new
`emit/aliases.ts` produces `<ns>/zod/aliases.ts` — one
`export const <Name>Schema: z.ZodType<<Name>> = …` plus `export type <Name> = …`
per `SourceIR.typeAliases` entry — re-exported from the `<ns>/zod` barrel, with
each alias also surfaced in the generator artifact as
`entities['<ns>.<Name>']` (`module: <ns>/zod/aliases`,
`symbols: { schema, type }`). Entity fields carrying a `ref` / `union` type
import the referenced enum / alias / entity schemas and, when a `ref` is
present, get a hand-written DTO with a `z.ZodType` annotation so a recursive
reference type-checks.
