# Bug: `@kurotako/parser-prisma` (version-8 mode) confuses storage column names with model field names

**Status**: technical design done, see [`technical.md`](technical.md) — fix not started

## Context

Found while running `tako generate` for the first time against a real,
already-configured `db` source (Prisma 8 → Zod) in a downstream monorepo
([`ekoz`](https://github.com/marmotz/ekoz), see its
[SDK foundations technical design §11](https://github.com/marmotz/ekoz/blob/develop/backlog/features/sdk-foundations/technical.md#11-typage-bout-en-bout)
and [issue #21](https://github.com/marmotz/ekoz/issues/21)) — the source had
been wired in `tako.config.ts` for a while but never actually executed
(no `generate`/`check` script existed yet).

## Reproduction

`@kurotako/parser-prisma@0.2.1`, version-8 mode, against a `contract.json`
produced by `prisma contract emit` (Prisma `8.0.0-rc.10`,
`@prisma/orm-postgres` driver adapter). A model with a Prisma-level index on a
`@map`-ped field:

```prisma
model AuditLog {
  id          String  @id @default(ulid())
  actorUserId String? @map("actor_user_id")
  // ...
  @@index([actorUserId])
  @@map("audit_log")
}
```

`prisma contract emit` records the index under
`storage.namespaces.<ns>.entries.table.audit_log.indexes[0].columns`, using
the **storage column name** (`actor_user_id`), consistent with the rest of
that `storage.*.entries.table.*.columns` map (also keyed by column name).
`tako generate` fails:

```
tako error [driver_error]: parser 'prisma' (namespace 'db') threw during parse
  parser: prisma (namespace 'db')
  cause: db.AuditLog.indexes.0: index references unknown field 'actor_user_id'
```

## Root cause (confirmed)

Confirmed by reading `packages/parser-prisma/src/contract/read.ts`
(`readModels`, around lines 219-274). Within one model, `readField` (lines
221-236) correctly translates each domain field to its storage column via
`bridge.fields` (`bridgeFields[name].column`, name → column) before looking
it up in `table.columns`. But every other property built from the same
`table` object skips that translation and uses the storage-level `columns`
arrays verbatim, as if they were already field names:

- `field.isUnique` (line 244): computed from a `uniqueColumns` set built out
  of `table.uniques[].columns` (storage columns), then compared against
  `field.name` (a domain field name) — always `false` for a `@map`-ped
  unique field.
- `primaryKey` (line 255): `strings(table.primaryKey.columns)` — storage
  columns, not field names.
- `uniques[].fields` (line 258): same, from `table.uniques[].columns`.
- `indexes[].fields` (line 266): same, from `table.indexes[].columns` — the
  originally reported case.

This is one bug, not four: all four sites read from the same `table` object
and need the same missing translation, through the same `bridge.fields`
mapping already used two lines above them.

A fifth, related site exists in the same file: `readRelationEdges` (lines
129-167) matches a domain relation to its foreign key by comparing
`table.foreignKeys[].source.columns` (storage columns) directly against
`on.localFields` (domain field names, from `contract.json`'s
`domain.*.relations.*.on.localFields`) at line 147. This only happens to
work today because the fixture has no `@map`-ped relation scalar field; with
one, the match would silently fail and `fromFields`/`toFields`/`onDelete`/
`onUpdate` would come back empty instead of throwing.

The DMMF-mode reader (`packages/parser-prisma/src/dmmf/read.ts`,
`readPrimaryKey`/`readUniques`/`readIndexes`/`readField`) does not have this
problem — Prisma's DMMF already reports `primaryKey.fields`,
`uniqueIndexes[].fields`, `datamodel.indexes[].fields` and `field.isUnique`
in terms of field names, so there was nothing to translate. This is
presumably why the bug wasn't caught earlier: it only exists in version-8
(contract) mode.

This reproduced identically after bumping `@kurotako/core`/`@kurotako/config`
from `0.1.2` to the latest published `0.1.3` (the patch that fixed the
unrelated IR `array`/`map` validation gap — see the `@kurotako/ir@0.3.0`
compatibility notes in the `parser-openapi`/`gen-typescript` release history),
so it is not the same root cause as that fix.

## Impact

Any Prisma 8 schema with a `@map`-ped field that is also part of a primary
key, a `@unique`/`@@unique`, or a `@@index` cannot be parsed correctly in
version-8 mode — not just the originally reported `@@index` case. Depending
on the site, this either throws (`indexes`/`uniques`/`primaryKey` reference
an unknown field) or silently produces a wrong IR (`isUnique: false` on a
field that is actually unique, with no error). This blocks `tako
generate`/`tako check` entirely for the affected namespace where it throws —
there is no partial-success mode — and produces incorrect generated output
(e.g. missing uniqueness validation) where it doesn't.

A `@map`-ped relation scalar field (e.g. a foreign key column renamed via
`@map`) additionally loses its `fromFields`/`toFields`/`onDelete`/`onUpdate`
silently, with no error. Worse, `packages/parser-prisma/src/map/relations.ts`
(`isImplicitM2M`, lines 63-72) treats a two-edge relation with empty
`fromFields`/`toFields` on both sides as an **implicit many-to-many** —
so an explicit one-to-many relation with a `@map`-ped FK scalar can be
silently misclassified as an implicit m:n join table in the generated IR.

## Impact on the downstream task

The `ekoz` `db` source (Prisma → Zod) remains unexecuted; its
`apps/server/src/generated` output was never produced, and the `check` CI job
being wired for the *unrelated* `api` (OpenAPI) source will also fail on this
until it's fixed, since `tako check` validates every configured source in one
run.

## Decisions made

- **Scope**: fix `isUnique`, `primaryKey`, `uniques`, `indexes` (in
  `readModels`) and the foreign-key match in `readRelationEdges` together,
  as one change — one bug, one PR, not a narrower patch with follow-up bugs
  for the rest.
- **Approach**: build one column→fieldName map (the inverse of
  `bridge.fields`, which is name→column) once per model in `readModels`,
  and reuse it at all five sites instead of resolving each column
  independently at its point of use.

## Suggested fix

In `readModels`, right after `bridgeFields` is read (line 220), build its
inverse (`column → field name`) once per model, and use it to translate:

- `table.uniques[].columns` before comparing against `field.name` for
  `isUnique`;
- `table.primaryKey.columns` for `primaryKey`;
- `table.uniques[].columns` for `uniques[].fields`;
- `table.indexes[].columns` for `indexes[].fields`;
- `table.foreignKeys[].source.columns` in `readRelationEdges`, before
  comparing against `on.localFields`.

Same translation `readField` already applies going the other way
(field name → column) two lines above.
