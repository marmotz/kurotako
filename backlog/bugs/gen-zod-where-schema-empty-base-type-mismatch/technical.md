# Technical design: fix `Where`/`WhereDeep` type assembly when the entity has zero own filterable fields

See [`overview.md`](overview.md) for the decided scope.

## Root cause, precisely

`packages/gen-zod/src/emit/entity.ts:302-337` (`renderWhereBlock`) always
builds `${dto}` as one intersection:

```
z.infer<typeof ${baseName}>${typeIntersection(relTyped)} & { AND?: ...; OR?: ...; NOT?: ...; };
```

`baseName` (`entity.ts:322`) is `objectExpr(ownEntries)` — `ownEntries` comes
only from fields that have a `filterClass` (`entity.ts:307-315`,
`packages/gen-zod/src/render/variants.ts:53` `filterClass`). When an entity's
fields are all relations or all `{ kind: 'unknown' }` (no `filterClass`),
`ownEntries` is empty and `objectExpr` (`entity.ts:57-63`) emits
`z.object({})`.

Zod v4's `z.infer<typeof z.object({})>` is not `{}` — it carries an implicit
`Record<string, never>`-shaped index signature. Intersecting that with
`{ AND?: T | T[]; ... }` makes every added property collide with the index
signature (`AND` is not assignable to `never`), so `tsc` rejects the
`z.ZodType<${dto}>` annotation on `${name}`. Confirmed against the installed
`zod@4.4.3`/`4.6.2` typings by compiling both the current shape and a
`.strict()` variant in isolation — both fail identically:

```
error TS2322: ... Property 'AND' is incompatible with index signature.
  Type 'Dto' is not assignable to type 'never'.
```

`.strict()` doesn't change zod's inferred shape for an empty object schema;
it does not fix this. This rules out the first candidate from `overview.md`.

A third variant — dropping the `z.infer<typeof ${baseName}>` intersection
member entirely when `ownEntries.length === 0` (the base contributes nothing
to the type in that case, so referencing it in the type is unnecessary, not
just broken) — compiles clean under the same check. This confirms the
second candidate from `overview.md`.

## Fix

In `renderWhereBlock`, only include the `z.infer<typeof ${baseName}>` member
in the `${dto}` type expression when `ownEntries.length > 0`. The runtime
expression (`${baseName} = ${objectExpr(ownEntries)}`, still `z.object({})`
when empty) doesn't need to change — an empty Zod object schema is fine at
runtime; only its use inside a type intersection is the problem.

Concretely, replace the single-string concatenation
(`entity.ts:334`) with a list of type members, built conditionally, then
`.join(' & ')`:

- `z.infer<typeof ${baseName}>` — only when `ownEntries.length > 0`.
- the relation members — reuse `typeIntersection(relTyped)`'s object body,
  but without its own leading `` & `` (`typeIntersection` currently always
  prefixes `` & ``; either add a variant that returns just the `{ ... }`
  block or inline the body construction here) — only when `relTyped.length >
  0`.
- the `{ AND?: ${dto} | ${dto}[]; OR?: ...; NOT?: ...; }` block — always
  present (this is what makes `Where`/`WhereDeep` recursive).

This mirrors the existing `renderRecordBlock` pattern of conditionally
including type members (`entity.ts:294-299` already treats the relation
intersection as optional via `typeIntersection`'s own empty-array guard) —
this fix extends the same conditional-inclusion approach to the base member.

No change needed to `objectExpr`, `extendExpr`, or `filterClass` — the fix is
isolated to how `renderWhereBlock` assembles the type string, matching the
`overview.md` scope decision (fix in `Where`-assembly, not upstream field
classification).

## Scope of the code change

- `packages/gen-zod/src/emit/entity.ts` — `renderWhereBlock` (`entity.ts:334`)
  and, if extracted, a small helper alongside `typeIntersection`
  (`entity.ts:70-78`) for the "body only, no leading `&`" variant.
- `packages/gen-zod/src/emit/entity.test.ts` — add a regression case: an
  entity whose fields all lack a `filterClass` (e.g. all fields relations, or
  a field typed `{ kind: 'unknown' }`), asserting the emitted
  `${dto}` type has no `z.infer<typeof ${baseName}Base>` member and that the
  output is valid TypeScript (or, at minimum, snapshot the exact string and
  cross-check the shape). Existing `UserWhereDto` case (`entity.test.ts:42`,
  `:80-86`, has own filterable fields) continues to exercise the non-empty
  path unchanged.

## Out of scope here

- `parser-openapi`'s `unknown`-hint classification for inline enums (separate
  known limitation, referenced in `overview.md`).
- The other two `gen-zod` bugs filed the same session
  ([gen-zod-unknown-hint-comment-swallows-comma](../gen-zod-unknown-hint-comment-swallows-comma/overview.md),
  [gen-zod-verbatim-module-syntax-type-only-exports](../gen-zod-verbatim-module-syntax-type-only-exports/overview.md)) —
  unrelated code paths, no shared fix.

## Task breakdown

- [#168](https://github.com/marmotz/kurotako/issues/168) — fix the `Where`/
  `WhereDeep` type assembly for entities with zero own filterable fields, plus
  the regression test.
