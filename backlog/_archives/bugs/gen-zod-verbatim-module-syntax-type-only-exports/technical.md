# Technical design: type-only imports/exports in generated `zod` output

See [`overview.md`](overview.md) for the decided scope of each part.

## Part 1 — `gen-zod` sibling imports

In `packages/gen-zod/src/emit/entity.ts`'s `buildImports`, the sibling loop
(lines 446-454) currently does:

```ts
for (const target of [...siblings.keys()].sort((a, b) => a.localeCompare(b))) {
  const names = [...(siblings.get(target) ?? [])]
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
  const spec = jsFile(`./${target}.schema`);
  lines.push({ spec, stmt: `import { ${names} } from '${spec}';` });
}
```

`siblings.get(target)` is a flat `Set<string>` mixing schema-const names
(values) and `Dto` type names (types) for the same target file — the caller
that populates it (`recordTypeDeps`/`ownSiblings`-equivalent, upstream of this
function) would need to be checked for whether it already knows which is
which, or whether that distinction needs adding there too. Whichever layer
carries the distinction, the fix here is the same shape as the `aliases`
branch immediately above it: wrap each name known to be a type with a literal
`type ` prefix before joining, e.g. (assuming a `{ value: string; isType:
boolean }[]` or two separate sets are available by the time this function
runs):

```ts
const names = [...(siblings.get(target) ?? [])]
  .sort((a, b) => a.localeCompare(b))
  .map((n) => (isTypeName(target, n) ? `type ${n}` : n))
  .join(', ');
```

`packages/gen-zod/src/emit/entity.test.ts` should gain a case: an entity whose
`Deep`/`Where` variant imports a sibling only used in type position, asserting
the import statement marks that specifier `type`.

## Part 2 — `core`'s root-barrel collision re-export

`packages/core/src/writer/barrel.ts`'s `synthesizeRootBarrels` picks a winner
per colliding name and writes:

```ts
`export { ${identifier} } from '${jsIndex(`./${owners[0]}`)}';`
```

`core` has no notion today of whether `identifier` is a type or a value —
`GenOutput`/`VirtualFile` (`packages/core/src/types.ts:139-155`) carry emitted
file content, not a symbol table. Two directions, in order of preference:

1. **Generators report symbol kind alongside files.** Extend `GenOutput` (or
   `GeneratorArtifact`, which already exists as a side-channel for
   cross-generator dependencies — `packages/core/src/types.ts:156`) with a map
   of exported-name → `'type' | 'value'` per file, populated by each
   generator's own emit code (it already knows this when it writes `export
   const Xxx = ...` vs `export type Xxx = ...`). `synthesizeRootBarrels` reads
   that map to choose `export` vs `export type` per collision. More invasive
   (touches every generator's `GenOutput` construction, `gen-typescript` and
   `gen-angular` included even though only `gen-zod` mixes const+type exports
   per entity today) but correct without guessing, and reusable for anything
   else that needs symbol-kind info later.
2. **Sniff the winning file's source for the declaration.** Cheaper, but
   fragile: `synthesizeRootBarrels` would need to parse (or regex-match)
   `owners[0]`'s file content for `export (?:const|function|class) ${identifier}`
   vs `export type ${identifier}` — duplicates a tiny bit of TS parsing inside
   `core`, and breaks silently if a generator's declaration style changes.

Option 1 is preferred for the same reason as the sibling-import fix: it keeps
`core` correct by construction instead of by convention-sniffing, at the cost
of a small, one-time `GenOutput` shape change.

## Suggested order

Fix Part 1 first — small, self-contained, same pattern already proven
correct by the `aliases` branch. Part 2 needs the `GenOutput` shape decision
made first (affects every generator), so it's the bigger piece; both are
needed for `packages/sdk/src/generated/api/index.ts` (ekoz) to typecheck
under `verbatimModuleSyntax`, since that file exercises both bugs at once.

## Implementation tasks

- Part 1 — [issue #166](https://github.com/marmotz/kurotako/issues/166):
  type-only import for sibling `Dto` references in `buildImports`.
- Part 2 — [issue #167](https://github.com/marmotz/kurotako/issues/167):
  track type vs value symbol kind for synthesized root-barrel re-exports.

## Out of scope here

- [gen-zod-where-schema-empty-base-type-mismatch](../gen-zod-where-schema-empty-base-type-mismatch/overview.md) —
  a `TS2322` type-checking failure (not an import/export syntax issue), found
  in the same `ekoz` session, filed separately.
