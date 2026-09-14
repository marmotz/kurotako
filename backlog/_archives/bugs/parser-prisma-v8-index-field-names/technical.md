# Technical design: column→field translation in `contract/read.ts`

See [`overview.md`](overview.md) for the decided scope and approach.

## Scope boundary

Version-8 (`contract.json`) mode only —
`packages/parser-prisma/src/contract/read.ts`. The DMMF reader
(`packages/parser-prisma/src/dmmf/read.ts`) is unaffected: Prisma's DMMF
already reports `primaryKey.fields`, `uniqueIndexes[].fields`,
`datamodel.indexes[].fields`, `field.isUnique`, and
`relationFromFields`/`relationToFields` in terms of field names, so there is
nothing to translate there.

Five sites in `read.ts`, all reachable from one `readModels` function, read
raw storage column names from `table` (the object returned by
`storageTable()`, line 31) and treat them as field names without going
through `bridge.fields` (`bridgeFields`, name → column) the way `readField`
already does at lines 221-236:

| Site | Line | Reads | Compared against / used as |
|---|---|---|---|
| `field.isUnique` | 238-244 | `table.uniques[].columns` | `field.name` |
| `primaryKey` | 255 | `table.primaryKey.columns` | returned as `PrismaEntity.primaryKey: string[]` |
| `uniques[].fields` | 256-263 | `table.uniques[].columns` | returned as `PrismaUnique.fields` |
| `indexes[].fields` | 264-274 | `table.indexes[].columns` | returned as `PrismaIndex.fields` |
| FK match in `readRelationEdges` | 144-148 | `table.foreignKeys[].source.columns` | `on.localFields` (domain field names, from `contract.json`'s `domain.*.relations.*.on.localFields`) |

`map/build.ts` (`buildEntity`, lines ~180-198) consumes
`entity.primaryKey`/`entity.uniques[].fields`/`entity.indexes[].fields` as
field names (`eb.primaryKey(...)`, `eb.unique(unique.fields, ...)`,
`eb.index(index.fields, ...)`) — confirming these must hold field names, not
columns, by the time `readModels` returns.

## Shared helper — inverse of `bridgeFields`

In `readModels`, right after `bridgeFields` is read (`read.ts:220`), build
its inverse once per model:

```ts
const columnToField = new Map(
  Object.entries(bridgeFields).map(([name, raw]) => [
    String(record(raw).column),
    name,
  ]),
);
```

And a small helper near the top of the file, alongside `strings()`:

```ts
function toFieldNames(columns: string[], columnToField: Map<string, string>): string[] {
  return columns.map((column) => columnToField.get(column) ?? column);
}
```

The `?? column` fallback is defensive only (a column not found in
`bridgeFields` shouldn't happen for a well-formed `contract.json`); it keeps
behavior on malformed input a silent no-op translation rather than a new
throw, consistent with how the rest of `read.ts` favors `record()`/`strings()`
tolerant parsing over new validation.

## Call sites to update

All within `readModels` (lines 207-280-ish):

- **`isUnique`** (currently lines 238-244): translate
  `table.uniques[].columns` through `toFieldNames` before building the
  `uniqueColumns` set, so the set holds field names and the existing
  `uniqueColumns.has(field.name)` comparison becomes correct.
- **`primaryKey`** (line 255): wrap with
  `toFieldNames(strings(table.primaryKey.columns), columnToField)`.
- **`uniques[].fields`** (line 258): wrap the existing
  `strings(record(entry).columns)` with `toFieldNames(...)`.
- **`indexes[].fields`** (line 266): same, wrap with `toFieldNames(...)`.

## `readRelationEdges` — separate translation

`readRelationEdges` (lines 129-167) doesn't have access to `bridgeFields`
today — it's called from `readModels` at line 249 with only `(model.relations,
names, sourceName, table)`. Two options:

- **A**: pass `columnToField` into `readRelationEdges` as a fifth parameter,
  and translate `source.columns` (line 147) with it before the
  `JSON.stringify` comparison.
- **B**: translate `table.foreignKeys[].source.columns` once, ahead of the
  call, into a pre-translated copy of `table` — more indirection for no
  benefit here.

**Chosen: A.** `columnToField` is already computed in `readModels`, and
`readRelationEdges` is a private, single-call-site function in the same
module — passing it through is the smallest change.

```ts
function readRelationEdges(
  relations: RawRecord,
  names: Map<string, string>,
  sourceName: string,
  table: RawRecord,
  columnToField: Map<string, string>,
): PrismaRelationEdge[] {
  // ...
  const fk = foreignKeys.find((candidate) => {
    const source = record(candidate.source);
    return (
      JSON.stringify(toFieldNames(strings(source.columns), columnToField)) ===
      JSON.stringify(localFields)
    );
  });
  // ...
}
```

Only `source.columns` needs translation — `target.columns` (line 989 in the
fixture, the *other* table's PK) is never compared against anything in this
function and isn't read at all today; `on.localFields`/`on.targetFields` are
already domain field names on both sides, nothing to change there.

## Fixture and test coverage

None of the five sites are exercised today with a `@map`-ped field: every
model in `packages/parser-prisma/src/contract/__fixtures__/contract.json`
has identical field and column names. `read.test.ts` only asserts
`user?.primaryKey` / `user?.uniques` on the (unmapped) `User` model.

Add one `@map`-ped case that exercises all five sites through fixture reuse
rather than a new model, using data already close to what's needed:

- **`Post.authorId` → `@map("author_id")`**. This field already appears in
  two indexes (`post_authorId_idx_e47547ed`,
  `post_author_published_idx_5940983d`) and is the FK scalar for the
  `author` relation (`on.localFields: ["authorId"]`,
  `foreignKeys[0].source.columns: ["authorId"]`, `onDelete: "restrict"`,
  `onUpdate: "cascade"`) — one change exercises `indexes[].fields`
  (multi-column and single-column) and the FK match in one go.
- **`Tag.name` → `@map("tag_name")`**. `Tag.name` is `@unique`
  (`uniques: [{"columns": ["name"]}]`) and is not part of any index or FK —
  exercises `isUnique` and `uniques[].fields` independently of the `Post`
  change.

Neither field is a primary key in the fixture (every model's PK is an
unmapped `id`/`postId`+`tagId`); `primaryKey` translation is exercised by
adding `@map("post_id")`/`@map("tag_id")` to **`PostTag.postId`/`.tagId`**
instead — already the fixture's only composite primary key
(`primaryKey.columns: ["postId", "tagId"]`), also already indexed
individually (`postTag_postId_idx_a7a72715`, `postTag_tagId_idx_86854244`)
and referenced by two FKs (`author`/`tag` relations on `PostTag`) — covering
`primaryKey`, `indexes[].fields`, and a second FK match.

Concretely, in `contract.json`:

- `domain.namespaces.public.models.Post.storage.fields.authorId.column`:
  `"authorId"` → `"author_id"` (line 323).
- `storage.namespaces.public.entries.table.post.columns`: rename the
  `"authorId"` key (line 931) to `"author_id"`.
- `storage.namespaces.public.entries.table.post.foreignKeys[0].source.columns`:
  `["authorId"]` → `["author_id"]` (line 984).
- `storage.namespaces.public.entries.table.post.indexes[0,1].columns`:
  `["authorId"]` → `["author_id"]`, `["authorId", "published"]` →
  `["author_id", "published"]` (lines 997, 1003).
- Same pattern for `Tag.name` (`domain.*.Tag.storage.fields.name.column`,
  `storage.*.table.tag.columns` key, `storage.*.table.tag.uniques[0].columns`)
  and for `PostTag.postId`/`.tagId` (domain storage fields, `table.postTag`
  columns keys, `foreignKeys[].source.columns`, `indexes[].columns`,
  `primaryKey.columns`).
- Mirror the same `@map(...)` additions in
  `packages/parser-prisma/src/contract/__fixtures__/contract.prisma` (not
  read by tests, but is the documented source of truth for how the fixture
  was generated — must stay consistent with it, per
  `packages/parser-prisma/src/contract/__fixtures__/contract.prisma`'s role
  as the schema `contract.json` was captured from).

New/updated assertions in `read.test.ts`:

```ts
const post = model.entities.find((entity) => entity.name === 'Post');
expect(post?.indexes).toContainEqual({
  fields: ['authorId'],
  name: 'post_authorId_idx_e47547ed',
});
expect(post?.indexes).toContainEqual(
  expect.objectContaining({ fields: ['authorId', 'published'] }),
);
expect(
  post?.relationEdges.find((e) => e.fieldName === 'author'),
).toMatchObject({ fromFields: ['authorId'], toFields: ['id'] });

const tag = model.entities.find((entity) => entity.name === 'Tag');
expect(tag?.uniques).toContainEqual({ fields: ['name'] });
expect(tag?.fields.find((f) => f.name === 'name')?.isUnique).toBe(true);

const postTag = model.entities.find((entity) => entity.name === 'PostTag');
expect(postTag?.primaryKey).toEqual(['postId', 'tagId']);
```

`map/relations.test.ts` and `parser.test.ts` build their own inline Prisma
schema strings (DMMF mode) and don't read `contract.json` — unaffected by
this fixture change.

## Test impact

- `packages/parser-prisma/src/contract/read.test.ts` — extend per above.
- No change needed in `packages/parser-prisma/src/map/build.ts`,
  `map/relations.ts`, or their tests: they already consume field names: the
  fixture change only makes the existing (currently-passing-by-accident)
  translation assumptions actually exercised.

## Découpage en tâches d'implémentation

One issue, per the "one bug, one PR" decision in [`overview.md`](overview.md):

1. [#159](https://github.com/marmotz/kurotako/issues/159) — parser-prisma: contract mode confuses storage column names with domain field names (indexes, uniques, primaryKey, isUnique, FK match).
