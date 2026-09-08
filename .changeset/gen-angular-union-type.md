---
"@kurotako/gen-angular": minor
---

Union-type control support. A `{ kind: 'ref' }` field now types its control as
the Zod-emitted DTO / alias name (`FormControl<AddressDto>`); a non-discriminated
`union` types as the variant types joined (`FormControl<string | number>`), a branch whose ref is
in `GenerateContext.cycles` widening the control to `unknown`. Both fallback
controls carry a `// union: validated by zodValidator(schema)` note and a
`logger.warn`.

A **discriminated** union field (`discriminator.mapping` set, every target an
entity in the same source) becomes a nested `FormGroup` holding a discriminator
`FormControl` plus one `FormGroup<<Variant>FormControls>` per discriminator
value, built by delegating to the target entity's injected `FormFactory`. A new
runtime helper `switchDiscriminatedGroup` toggles the active sub-group on the
discriminator control's `valueChanges` and rewrites the group's `getRawValue()`
to the flat active-variant shape a root `z.discriminatedUnion` schema can parse.

A `{ kind: 'ref' }` field whose target is an alias resolves its type through the
Zod artifact's alias entry; `gen-angular` itself adds no alias entry to its own
artifact (aliases produce no Angular form and `gen-zod`'s `<ns>/zod/aliases.ts`
is the single exporter — re-declaring them would make the root-barrel ambiguity
check flag a phantom conflict).
