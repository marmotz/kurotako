# parser-prisma rejects a Prisma 8 expression index as an invalid contract

**Status**: fixed — [#192](https://github.com/marmotz/kurotako/issues/192) and [#193](https://github.com/marmotz/kurotako/issues/193) shipped; design in [technical.md](technical.md).

## Context

In the `ekoz` repo, `Room` declares a GIN full-text index over an expression,
not a column list (`apps/server/src/core/prisma/contract.prisma`):

```prisma
@@index(
  expression: "to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(topic, ''))",
  type: "gin",
  name: "room_directory_fts"
)
```

Prisma 8 emits this correctly in `contract.json`, as an index entry with no
`columns` key at all:

```json
{
  "expression": "to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(topic, ''))",
  "name": "room_directory_fts_4bb947ef",
  "prefix": "room_directory_fts",
  "type": "gin",
  "unique": false
}
```

Running `bun run check` (`tako check`, which runs Kurotako's `prisma` parser
over that contract) fails outright:

```
tako error [driver_error]: parser 'prisma' (namespace 'db') threw during parse
  parser: prisma (namespace 'db')
  cause [prisma_contract]: invalid Prisma 8 contract.json: invalid structure at storage.namespaces.public.entries.table.room.indexes.0.columns
error: script "check" exited with code 1
```

## Root cause

Confirmed at two levels, both hard-requiring `columns` on every index entry
with no accommodation for an expression index:

- [`packages/parser-prisma/src/contract/schema.ts:76-84`](../../../../packages/parser-prisma/src/contract/schema.ts) —
  the valibot `table.indexes` entry schema is
  `v.looseObject({ columns: v.array(v.string()), name: v.optional(v.string()), type: v.optional(v.string()) })`.
  `columns` is mandatory, so any index entry that instead carries
  `expression` (and no `columns`) fails validation at exactly the reported
  path — this is the error being thrown.
- [`packages/parser-prisma/src/contract/read.ts:283-293`](../../../../packages/parser-prisma/src/contract/read.ts) —
  even past validation, the mapping into `PrismaEntity.indexes` reads
  `entry.columns` unconditionally (`toFieldNames(strings(record(entry).columns), columnToField)`)
  with no branch for an `expression`-only entry.
- [`packages/ir/src/schemas.ts:184-188`](../../../../packages/ir/src/schemas.ts) —
  the IR itself has no representation for an expression index either:
  `IndexDefSchema` is `{ fields: string[], name?, type? }`, with no
  `expression` member. So this is not just a `parser-prisma` validation gap;
  the IR has nowhere to put an expression-based index even once parsed.

Prisma 8's own contract format supports expression indexes as a first-class
shape (an index entry with `expression` instead of `columns`, per
`references/contract.md` in the `prisma-8` skill's index documentation) — this
is not malformed input, `parser-prisma` (and the IR it feeds) just doesn't
model that shape yet.

## Goal

`tako check` / `tako generate` must accept a Prisma 8 contract whose table
has an expression-based index (`expression` + no `columns`) without throwing,
for at least the `gin`/`btree`-on-expression cases Postgres supports. What the
IR does with that index (represent it faithfully with a new `expression`
field vs. drop it silently, since no current generator emits index DDL) is
left to `technical.md`.

A column-list index (`columns` present) must keep working exactly as today.

## Decisions acted upon

- Scope starts at `parser-prisma` (the actual crash) and `packages/ir`
  (the representation gap that crash points at) — no generator currently
  reads `EntitySchema.indexes` for its output, so this bug does not by itself
  require touching a generator; confirm that while designing the fix.
- `IndexDefSchema` becomes a discriminated union: a column-list index
  (`fields`) or an expression index (`expression`), mutually exclusive —
  rather than adding a loose optional `expression` field alongside `fields`.
  Exact discriminant/shape is for `technical.md` to detail.
- An expression index is represented faithfully in the IR (not tolerated
  then dropped), even though no generator consumes it yet — avoids silent
  information loss and keeps the door open for a future DDL-emitting
  generator.
