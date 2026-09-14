# Technical design: fix the comma/comment ordering in `gen-zod`'s object emission

See [`overview.md`](overview.md) for the decided scope.

## Root cause, precisely

- `packages/gen-zod/src/render/field.ts:48-49` (`fieldExpr`) returns one
  string per field: the Zod expression, and — when the field's type is
  `{ kind: 'unknown' }` — a trailing `// unknown[: hint]` line comment,
  appended with a single space, comment last. This is correct and tested
  (`packages/gen-zod/src/render/field.test.ts:88-97`); a trailing comment is
  the right shape for a value that's about to be followed by a comma.
- `packages/gen-zod/src/emit/entity.ts` has two call sites that turn a list of
  `[key, valueExpr]` entries into object-literal source, both building each
  line as `` `  ${k}: ${v},` `` — comma appended unconditionally after `v`:
  - `objectExpr` (line 54) — the common case, every `full`/`deep`/`create`/
    `update` variant with no relations.
  - `extendExpr` (line 59) — the `deep` variant with relations, via
    `z.lazy(() => Base.extend({ ... }))`.

  When `v` is `fieldExpr`'s output for an `unknown`-hint field, `v` already
  ends in `// unknown: enum`; appending `,` puts it after `//`, inside the
  comment.

## Suggested fix

Stop giving `fieldExpr` the job of placing the comment relative to a comma it
doesn't control. Two ways to do this, in order of preference:

1. **Split `fieldExpr`'s return into `{ expr, comment }`.** `objectExpr` /
   `extendExpr` then build the line themselves:
   `` `  ${k}: ${expr}${comment ? ` /* ${comment} */` : ''},` `` — using a
   block comment (`/* ... */`) instead of a line comment sidesteps the
   ordering problem entirely (a block comment before the comma doesn't
   swallow anything after it), and reads fine either way:
   `status: z.unknown() /* unknown: enum */,`. Requires updating
   `field.test.ts`'s one assertion and every call site of `fieldExpr` (both in
   `entity.ts`) to destructure instead of using the string directly.
2. **Keep `fieldExpr`'s single-string return, move the comma before the
   comment in the caller.** `objectExpr`/`extendExpr` would need to detect a
   trailing `// ...` on `v` and splice the comma before it
   (`` v.includes(' //') ? v.replace(' //', ', //') : `${v},` ``-shaped) —
   works, but it's string-sniffing a convention `field.ts` owns, and silently
   breaks again if `fieldExpr` ever grows a second kind of trailing
   annotation. Only worth it if changing `fieldExpr`'s return shape is
   considered too invasive for how small this fix should be.

Option 1 is preferred: it removes the string-format coupling between
`field.ts` and `entity.ts` instead of adding a second layer of it, and a block
comment is unambiguous regardless of what follows on the line.

## Scope of the code change

- `packages/gen-zod/src/render/field.ts` — `fieldExpr` return shape (option 1)
  or no change (option 2).
- `packages/gen-zod/src/emit/entity.ts` — `objectExpr`, `extendExpr`.
- `packages/gen-zod/src/render/field.test.ts` — update the "unknown field
  keeps the hint comment" assertion for the new return shape/format.
- `packages/gen-zod/src/emit/entity.test.ts` (if it doesn't already cover a
  non-trailing `unknown`-hint field, add a case that does — a regression test
  for this exact bug: an object with a middle property whose type is
  `{ kind: 'unknown' }`, asserting the emitted object parses as valid
  TypeScript / has a comma immediately after the value, before any comment).

## Out of scope here

- Whether `parser-openapi` should classify inline enums as something other
  than `unknown` (see `overview.md` "Related, out of scope") — orthogonal;
  fixing only this bug still leaves inline-enum fields typed as `unknown`,
  just syntactically valid.
- Any other `{ kind: 'unknown' }` producer/consumer path outside `gen-zod`
  (`gen-typescript` and `gen-angular` don't append a trailing comment the same
  way, so this specific comma bug is `gen-zod`-only; not verified whether they
  have their own unrelated issues with `unknown` fields).

## Task breakdown

- [#163](https://github.com/marmotz/kurotako/issues/163) — fix comma swallowed
  by the `unknown`-hint trailing comment in `objectExpr`/`extendExpr`.
