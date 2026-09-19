# Technical design — parser-prisma expression index support

Ref: [`overview.md`](overview.md).

## Summary

Model an expression-based index (`@@index(expression: "...", ...)`, no
`columns`) as a first-class, mutually-exclusive alternative to a column-list
index, at every layer it crosses: the Prisma 8 `contract.json` reader, the
parser-internal `PrismaIndex` shape, and `@kurotako/ir`'s `IndexDef`. All
three become a `kind: 'columns' | 'expression'` discriminated union —
mirroring how `FieldTypeSchema` and `DefaultValueSchema` already discriminate
on `kind` in [`packages/ir/src/schemas.ts`](../../../packages/ir/src/schemas.ts).

Confirmed by grep across `packages/*/src`: only `@kurotako/parser-prisma`
(both DMMF and contract read paths) and `@kurotako/ir` itself read or build
`IndexDef`/`PrismaIndex`. No generator, no other parser, touches
`Entity.indexes`. So this change is contained to those two packages plus
their tests — no generator package needs any change.

## `@kurotako/ir` — `IndexDef` becomes a discriminated union

[`packages/ir/src/schemas.ts:184-188`](../../../packages/ir/src/schemas.ts):

```ts
export const IndexDefSchema = v.object({
  fields: v.array(v.string()),
  name: v.optional(v.string()),
  type: v.optional(IndexTypeSchema),
});
```

becomes:

```ts
export const IndexDefSchema = v.variant('kind', [
  v.object({
    kind: v.literal('columns'),
    fields: v.array(v.string()),
    name: v.optional(v.string()),
    type: v.optional(IndexTypeSchema),
  }),
  v.object({
    kind: v.literal('expression'),
    expression: v.string(),
    name: v.optional(v.string()),
    type: v.optional(IndexTypeSchema),
  }),
]);
```

`IndexDef` (`packages/ir/src/types.ts:66`) is unchanged as `v.InferOutput<typeof IndexDefSchema>` — it now infers the union automatically.

This is a **breaking shape change**: every existing `IndexDef` literal
(`{ fields: [...] }`) needs a `kind: 'columns'` tag. Acceptable under the
`0.x` "public API may change between minor versions" policy
(`backlog/AGENTS.md`), but ships with a changeset on `@kurotako/ir`.

### `validate.ts` — guard the field-ref check

[`packages/ir/src/validate.ts:402-413`](../../../packages/ir/src/validate.ts)
currently reads `idx.fields` unconditionally:

```ts
entity.indexes.forEach((idx, i) => {
  for (const f of idx.fields) {
    if (!hasField(f)) { ... }
  }
});
```

An expression index has no `fields` to resolve (and no obligation to appear
in the entity's field set — the expression can reference columns not mapped
as IR fields, e.g. `to_tsvector(...)` over multiple concatenated columns).
Becomes:

```ts
entity.indexes.forEach((idx, i) => {
  if (idx.kind !== 'columns') return;
  for (const f of idx.fields) {
    if (!hasField(f)) { ... }
  }
});
```

No validation is added for `expression` content — it is opaque SQL text, same
treatment as `DefaultValueSchema`'s `expr` variant, which isn't parsed either.

### `builder.ts` — new `indexExpression()` on `EntityBuilder`

[`packages/ir/src/builder.ts:111`](../../../packages/ir/src/builder.ts) keeps
`index(fields, opts)` unchanged (its one call site and its shape are fine)
and gains a sibling method rather than turning `index()`'s first argument
into a union — keeps the existing call site and existing tests untouched,
and reads better at the call site than a `{fields} | {expression}` argument:

```ts
export interface EntityBuilder {
  ...
  index(fields: string[], opts?: { name?: string; type?: IndexType }): this;
  indexExpression(
    expression: string,
    opts?: { name?: string; type?: IndexType },
  ): this;
  ...
}
```

`EntityBuilderImpl` (`packages/ir/src/builder.ts:624-634`):

```ts
index(fields: string[], opts?: { name?: string; type?: IndexType }): this {
  const idx: IndexDef = { kind: 'columns', fields };
  if (opts?.name !== undefined) idx.name = opts.name;
  if (opts?.type !== undefined) idx.type = opts.type;
  this.#indexes.push(idx);
  return this;
}

indexExpression(
  expression: string,
  opts?: { name?: string; type?: IndexType },
): this {
  const idx: IndexDef = { kind: 'expression', expression };
  if (opts?.name !== undefined) idx.name = opts.name;
  if (opts?.type !== undefined) idx.type = opts.type;
  this.#indexes.push(idx);
  return this;
}
```

## `@kurotako/parser-prisma`

### `dmmf/model.ts` — `PrismaIndex` mirrors `IndexDef`

[`packages/parser-prisma/src/dmmf/model.ts:59-63`](../../../packages/parser-prisma/src/dmmf/model.ts):

```ts
export type PrismaIndex =
  | { kind: 'columns'; fields: string[]; name?: string; type?: string }
  | { kind: 'expression'; expression: string; name?: string; type?: string };
```

`dmmf/read.ts:99` (`readIndexes`, fed by `DMMF.Index`, which is always
column-based — the classic PSL `@@index([...])` grammar has no `expression:`
form) just tags its one branch:

```ts
const entry: PrismaIndex = { kind: 'columns', fields: idx.fields.map((f) => f.name) };
```

### `contract/schema.ts` — accept an expression index entry

[`packages/parser-prisma/src/contract/schema.ts:76-84`](../../../packages/parser-prisma/src/contract/schema.ts):

```ts
indexes: v.optional(
  v.array(
    v.looseObject({
      columns: v.array(v.string()),
      name: v.optional(v.string()),
      type: v.optional(v.string()),
    }),
  ),
),
```

becomes a `v.union` of two `looseObject`s (not `v.variant`, since the raw
JSON carries no explicit discriminant key — the discriminant is *presence*
of `columns` vs. `expression`, exactly as Prisma 8 emits it and as
`references/contract.md` in the `prisma-8` skill documents: `@@index` takes
either a field list or `expression:`, never both):

```ts
const indexColumnsEntry = v.looseObject({
  columns: v.array(v.string()),
  name: v.optional(v.string()),
  type: v.optional(v.string()),
});
const indexExpressionEntry = v.looseObject({
  expression: v.string(),
  name: v.optional(v.string()),
  type: v.optional(v.string()),
});

indexes: v.optional(v.array(v.union([indexExpressionEntry, indexColumnsEntry]))),
```

`indexExpressionEntry` first: an entry with `expression` and no `columns`
must not silently fall through to `indexColumnsEntry` and fail there with a
confusing `columns` error (the original bug's exact symptom) — `v.union`
tries schemas in order and returns the first success, so ordering here is
load-bearing, not cosmetic. `uniques`/`primaryKey`/`foreignKeys` stay
`columns`-only: `contract.md` documents `expression:` only for `@@index`, not
`@@unique` or `@id`.

### `contract/read.ts` — map into the new `PrismaIndex` union

[`packages/parser-prisma/src/contract/read.ts:283-293`](../../../packages/parser-prisma/src/contract/read.ts):

```ts
indexes: (Array.isArray(table.indexes) ? table.indexes : []).map((raw) => {
  const entry = record(raw);
  const common = {
    ...(typeof entry.name === 'string' ? { name: String(entry.name) } : {}),
    ...(typeof entry.type === 'string' ? { type: String(entry.type) } : {}),
  };
  return typeof entry.expression === 'string'
    ? { kind: 'expression' as const, expression: entry.expression, ...common }
    : {
        kind: 'columns' as const,
        fields: toFieldNames(strings(entry.columns), columnToField),
        ...common,
      };
}),
```

`columnToField` translation only applies to `columns` — an `expression`
carries raw SQL text (e.g. `coalesce(name, '')`), never a Prisma column
name, so there is nothing to translate.

### `map/build.ts` — branch on `kind`

[`packages/parser-prisma/src/map/build.ts:191-201`](../../../packages/parser-prisma/src/map/build.ts):

```ts
for (const index of entity.indexes) {
  const opts: { name?: string; type?: IndexType } = {};
  if (index.name) opts.name = index.name;
  const type = asIndexType(index.type);
  if (type) opts.type = type;
  if (index.kind === 'expression') {
    eb.indexExpression(index.expression, opts);
  } else {
    eb.index(index.fields, opts);
  }
}
```

## Out of scope (confirmed while designing, not silently dropped)

- Partial indexes (`where:` predicate) and the `unique:`/`prefix` keys
  `contract.md` documents on `@@index` are not modeled before this change
  and stay unmodeled after it — `table.indexes` entries stay `looseObject`,
  so those keys are tolerated (ignored) on both branches, not rejected. Not
  this bug's concern; column-list indexes already ignore them today.
- No generator reads `Entity.indexes` today (confirmed above), so no
  generator package changes, and there is nothing to verify end-to-end
  through a generator for this fix.

## Tests

- [`packages/ir/src/validate.test.ts`](../../../packages/ir/src/validate.test.ts) —
  update the existing `indexes: [{ fields: ['email'] }]` literal to
  `{ kind: 'columns', fields: ['email'] }`; add a case with
  `{ kind: 'expression', expression: 'lower(email)' }` asserting it produces
  no `unresolved_field_ref` issue.
- [`packages/ir/src/builder.test.ts`](../../../packages/ir/src/builder.test.ts) —
  add coverage for `.index(...)` (currently untested) and the new
  `.indexExpression(...)`, asserting the built `Entity.indexes` shape.
- [`packages/ir/src/schemas.test.ts`](../../../packages/ir/src/schemas.test.ts) —
  update the `indexes: []` fixture path only if it round-trips a non-empty
  index; add a parse case for both `IndexDefSchema` variants if none exists.
- [`packages/parser-prisma/src/dmmf/read.test.ts`](../../../packages/parser-prisma/src/dmmf/read.test.ts) —
  update any `PrismaIndex` literal assertions to the tagged shape.
- [`packages/parser-prisma/src/contract/read.test.ts`](../../../packages/parser-prisma/src/contract/read.test.ts) —
  update the `post?.indexes` assertions (`fields: [...]`) to
  `objectContaining({ kind: 'columns', fields: [...] })`; add a new
  expression index to the `Post` model in both fixture files
  ([`__fixtures__/contract.prisma`](../../../packages/parser-prisma/src/contract/__fixtures__/contract.prisma)
  and the captured
  [`__fixtures__/contract.json`](../../../packages/parser-prisma/src/contract/__fixtures__/contract.json),
  kept in sync by hand — mirroring the bug's real-world `Room.room_directory_fts`
  GIN index shape) and assert it reads as
  `{ kind: 'expression', expression: '...', name: '...', type: 'gin' }` with
  no exception thrown, i.e. the regression test for the original crash.
- `bun run check` (typecheck across the workspace) after the `IndexDef`
  shape change, since it is a breaking type change with only one non-test
  call site outside `@kurotako/ir` itself.

## Changesets

- `@kurotako/ir`: minor — `IndexDefSchema`/`IndexDef` shape change
  (discriminated union), new `EntityBuilder.indexExpression()`.
- `@kurotako/parser-prisma`: patch — fixes the crash on a Prisma 8 contract
  with an expression index; `PrismaIndex`/`PrismaEntity` are internal, not
  part of the package's public surface (`packages/parser-prisma/src/index.ts`
  exports only the driver, options, and error classes), so this alone isn't
  a public breaking change for this package — bump anyway since it now
  depends on the new `@kurotako/ir` minor.

## Documentation

- [`docs/ir.md:45`](../../../docs/ir.md) — update the `indexes: IndexDef[]`
  inline comment from `// { fields, name?, type? }` to reflect the
  `columns | expression` union.

## Découpage en tâches d'implémentation

1. [`@kurotako/ir` — model an expression-based index as a discriminated `IndexDef` union](https://github.com/marmotz/kurotako/issues/192)
2. [`@kurotako/parser-prisma` — accept a Prisma 8 expression index in `contract.json`](https://github.com/marmotz/kurotako/issues/193)
   (depends on #192)
