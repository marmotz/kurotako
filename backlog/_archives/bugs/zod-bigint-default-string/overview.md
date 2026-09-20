# gen-zod emits a string literal instead of a bigint literal for a BigInt field default

**Status**: fixed — [#175](https://github.com/marmotz/kurotako/issues/175) to [#178](https://github.com/marmotz/kurotako/issues/178) shipped; design in [technical.md](technical.md).

## Context

In the `ekoz` repo, `Room.lastSeq` is declared as:

```prisma
lastSeq BigInt @default(0) @map("last_seq")
```

`prisma contract emit` (which runs Kurotako's `gen-zod` generator) produced, in
`apps/server/src/generated/db/zod/Room.schema.ts`:

```ts
lastSeq: z.bigint().optional().default("0"),
```

`"0"` is a `string`, not assignable to Zod's `default()` overloads for
`ZodBigInt` (`bigint` or `() => bigint`), so TypeScript fails with TS2769 on
every `create`-variant schema that includes the field. It was hand-patched to
`.default(0n)` in the ekoz repo as a stopgap; that patch will be overwritten on
the next `prisma contract emit` unless fixed here.

Root cause: `packages/gen-zod/src/render/field.ts:53`

```ts
expr += `.default(${JSON.stringify(field.default.value)})`;
```

`JSON.stringify` has no native representation for `bigint` — it either throws
(a raw `bigint`) or, if the IR stores a bigint default as a `string` (likely,
to survive JSON serialization upstream in `parser-prisma`), it faithfully
re-quotes it, producing invalid Zod code for the `bigint` scalar.

Same root cause reproduces in two other generators that also render a
`bigint` field's literal default via `JSON.stringify`:

- `packages/gen-angular/src/render/controls.ts:158-159` (`initExpr`) — a
  `FormControl`'s initial value for a `bigint` field with a literal default
  would render as the string `'"0"'` instead of the bigint literal `0n`.
  `zeroValue` (same file, line 116) already renders `0n` for a `bigint`
  field with *no* literal default, so this only affects the literal-default
  path.
- `packages/gen-typescript/src/render/jsdoc.ts:24-25` — the `@default`
  JSDoc tag renders `@default "0"` instead of `@default 0n`. No compile
  error (it's a comment), but inconsistent with the other two once fixed.

## Goal

For a scalar field of type `bigint` with a literal default, every generator
that renders that default (`gen-zod`, `gen-angular`, `gen-typescript`) must
render it as an unquoted bigint literal (`0n`), not as the quoted string
`"0"`. Other scalar defaults (`number`, `boolean`, `string`, enum) are
unaffected — verify they still render correctly after the fix.

## Decisions acted upon

- Scope covers all three affected generators (`gen-zod`, `gen-angular`,
  `gen-typescript`), not just `gen-zod` — same root cause, one bug.
