# Technical design — bigint default renders as a quoted string

## Root cause

The IR is JSON-serializable by construction ([`packages/ir/src/schemas.ts:9-11`](../../../packages/ir/src/schemas.ts)):
`DefaultValueSchema`'s `value` variant is a `JsonValue`
([`packages/ir/src/schemas.ts:127`](../../../packages/ir/src/schemas.ts)), which has no
`bigint` member. A `bigint` field's literal default therefore has no valid
in-IR representation other than a numeric string — confirmed at the source:
Prisma's DMMF itself encodes a `BigInt` `@default` as a JS string, and
[`packages/parser-prisma/src/map/defaults.ts:35-38`](../../../packages/parser-prisma/src/map/defaults.ts)
passes any non-call literal through verbatim (`{ kind: 'value', value: raw }`),
so `field.default.value` for a `bigint` field is always the numeric string
Prisma reported (e.g. `"0"`), never a bare `number`.

Three render sites turn `field.default.value` into a source-code expression
via `JSON.stringify`, which re-quotes that string instead of producing a
bigint literal:

- [`packages/gen-zod/src/render/field.ts:53`](../../../packages/gen-zod/src/render/field.ts) —
  `` expr += `.default(${JSON.stringify(field.default.value)})` `` → `.default("0")`
  instead of `.default(0n)`. Breaks compilation (TS2769: `string` is not
  assignable to `ZodBigInt`'s `default()` overloads).
- [`packages/gen-angular/src/render/controls.ts:158-159`](../../../packages/gen-angular/src/render/controls.ts) —
  `initExpr` returns `JSON.stringify(field.default.value)` → the `FormControl`
  seed is the string `'"0"'` instead of `0n`. Same failure mode as gen-zod:
  the control is declared `FormControl<bigint>` (`SCALAR_BASE.bigint`, line 41)
  but seeded with a `string`.
- [`packages/gen-typescript/src/render/jsdoc.ts:24-25`](../../../packages/gen-typescript/src/render/jsdoc.ts) —
  `` tags.push(`@default ${JSON.stringify(field.default.value)}`) `` → renders
  `@default "0"` in the JSDoc comment. No compile error (it's a comment), but
  inconsistent with the other two once they're fixed.

Every other scalar (`number`, `boolean`, `string`, `date`/`datetime` as ISO
string, enum) already round-trips correctly through `JSON.stringify`, because
its IR-stored `value` matches its TS runtime representation. `bigint` is the
only scalar where the IR's JSON-safe storage format (`string`) differs from
its TS literal syntax (unquoted, `n`-suffixed).

## Design

### Shared helper in `@kurotako/ir`

Per the existing "shared-decision helpers" principle already stated at
[`packages/ir/src/helpers.ts:250-255`](../../../packages/ir/src/helpers.ts)
("any modelling rule that a parser or generator would otherwise
re-implement 'in its own way' lives here"), add one pure helper next to
`scalarTsType` (same file) and export it from the package barrel:

```ts
/**
 * A field's literal default value, rendered as the source-code expression
 * matching `scalarTsType`'s runtime representation. Only `bigint` differs
 * from `JSON.stringify`: the IR stores a bigint default as a numeric string
 * (JSON has no bigint literal — see `DefaultValueSchema`), so it is re-emitted
 * as an unquoted bigint literal (`0n`), not the quoted string `"0"`.
 */
export function defaultValueExpr(type: FieldType, value: JsonValue): string {
  if (type.kind === 'scalar' && type.scalar === 'bigint') {
    return `${value as string}n`;
  }
  return JSON.stringify(value);
}
```

`JsonValue` is already exported from `@kurotako/ir` ([`packages/ir/src/types.ts:27`](../../../packages/ir/src/types.ts)).
The cast is safe: a `bigint`-scalar field's default is only ever produced by
`mapDefault` passing through the DMMF's own string encoding (see Root cause);
nothing else on the IR-construction path produces a `bigint` default of a
different JSON type, so no runtime validation is added here — the IR's own
`v.safeParse` pass over `DefaultValueSchema` is what already guards the shape
on the way in.

### Call sites

All three become one-line call-site changes, no local branching left behind:

- `field.ts:53`: `` expr += `.default(${defaultValueExpr(field.type, field.default.value)})`; ``
- `controls.ts:159` (and the existing `line 155` in the `list`/`array`
  branch of `initExpr`, for consistency — see Edge cases): replace
  `JSON.stringify(field.default.value)` with `defaultValueExpr(field.type, field.default.value)`.
- `jsdoc.ts:25`: `` tags.push(`@default ${defaultValueExpr(field.type, field.default.value)}`); ``

Each file already imports from `@kurotako/ir`; only the import list changes
(`defaultValueExpr` added alongside the existing `Field` type import).

### Edge cases

- **List/array default of `bigint`** (`controls.ts:154-156`, and `field.ts`'s
  own `.default()` call which fires unconditionally regardless of `field.list`):
  Prisma does not support a scalar-list `@default` with literal `bigint`
  elements (list defaults are effectively `@default([])` only), so
  `field.default.value` is never an array of bigint strings in practice today.
  `defaultValueExpr` is still passed `field.type` (the list's *element* type
  is irrelevant here — `field.type.kind` would be `'scalar'` with `list: true`
  set separately, not `kind: 'array'`), so calling it uniformly for the list
  branch is correct as written and costs nothing; no dedicated array-of-bigint
  test is added since the input shape cannot occur from `parser-prisma` today.
- **Alternatives considered**: a generator-local `if (isBigint) ... else
  JSON.stringify(...)` in each of the three files was rejected per the
  discussion decision — same root cause, one fix, matching the file's own
  stated principle rather than re-diverging it three ways.
- **Negative / large bigint values** (`"-5"`, `"9223372036854775807"`): the
  template-literal concatenation (`` `${value}n` ``) handles both correctly
  since it operates on the string form directly, never round-tripping through
  `Number`.

## Consequences

- `gen-zod`: a `create`-variant schema for an entity with a `bigint
  @default(...)` field now type-checks (fixes the TS2769 reported in
  `docs/context: ekoz repo`).
- `gen-angular`: a `FormControl<bigint>` for such a field is now seeded with
  a real `bigint`, matching its declared type — previously a latent bug not
  yet reported (no entity in the current examples/fixtures exercises a
  `bigint` field with a literal, non-zero default through gen-angular).
- `gen-typescript`: `@default` JSDoc tag now reads `@default 0n` for a
  bigint field, consistent with the two others.
- No change to `parser-prisma` or the IR schema: the fix is entirely in how a
  literal default's JSON-safe string is turned back into a bigint literal at
  render time.
- A changeset is needed for `@kurotako/ir` (new exported helper,
  non-breaking addition), `@kurotako/gen-zod`, `@kurotako/gen-angular`, and
  `@kurotako/gen-typescript` (bug fix) — one changeset file can cover all
  four per `.changeset/README.md`.

## Test plan

- `packages/ir/src/helpers.test.ts`: `defaultValueExpr` — bigint value
  renders unquoted+`n` (`"0"` → `0n`, `"-5"` → `-5n`); every other scalar
  (`number`, `boolean`, `string`) still renders via plain `JSON.stringify`
  (e.g. `7` → `7`, `false` → `false`, `"x"` → `'"x"'`).
- `packages/gen-zod/src/render/field.test.ts`: add a bigint case next to the
  existing `'literal default -> .default() in create only'` test
  (line 67) — a `bigint` scalar field with `default: { kind: 'value', value:
  '0' }` renders `.default(0n)`, not `.default("0")`.
- `packages/gen-angular/src/render/controls.test.ts`: add a case in the
  `initExpr` describe block (line 132) — a `bigint` scalar field with a
  literal string default renders `initExpr` as `'0n'`, not `'"0"'`. Keep the
  existing no-default `bigint` → `'0n'` case (line 155) as-is; it exercises
  `zeroValue`, a different path, and stays a useful regression check that the
  two paths agree.
- `packages/gen-typescript/src/render/jsdoc.test.ts`: add a case — a `bigint`
  field with a literal default renders `@default 0n` in the JSDoc block.
- Re-run each package's full existing suite (`bun test` scoped per package)
  to confirm no other scalar default rendering regresses.

## Découpage en tâches d'implémentation

1. [#175 — ir: add defaultValueExpr shared helper for bigint literal defaults](https://github.com/marmotz/kurotako/issues/175)
2. [#176 — gen-zod: render bigint literal default as an unquoted bigint literal](https://github.com/marmotz/kurotako/issues/176) (depends on #175)
3. [#177 — gen-angular: seed a bigint FormControl's literal default as a bigint, not a string](https://github.com/marmotz/kurotako/issues/177) (depends on #175)
4. [#178 — gen-typescript: render @default JSDoc tag for a bigint field as a bigint literal](https://github.com/marmotz/kurotako/issues/178) (depends on #175)
