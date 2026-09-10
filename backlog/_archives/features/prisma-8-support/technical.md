# Prisma 8 support — technical design

Design for adding the **Prisma 8 mode** to `@kurotako/parser-prisma`. Product decisions
come from [overview.md](overview.md). The IR produced is unchanged
([`@kurotako/ir`](../ir-model/technical.md)); the driver contract is
unchanged ([`@kurotako/config`](../config-system/technical.md) /
[`@kurotako/core`](../core-pipeline/technical.md)). This document
turns the overview into a `contract.json` → `PrismaModel` reader plugged behind the
existing version-mode seam.

## Starting point (current code)

The v1 parser already ships the seam this feature fills in:

- [`src/detect.ts`](../../../../packages/parser-prisma/src/detect.ts) — `resolveInput()`
  returns `{ mode: 7, … }` or `{ mode: 8, kind: 'contract', contractPath }`
  ([detect.ts:17-19](../../../../packages/parser-prisma/src/detect.ts)). Mode 8 detection
  (`contract.json` file, or a folder containing one, or `version: 8`) is **already
  implemented and tested** ([detect.ts:102-161](../../../../packages/parser-prisma/src/detect.ts)).
- [`src/parser.ts:29-35`](../../../../packages/parser-prisma/src/parser.ts) — mode 8 currently
  throws `PrismaInputError('… not implemented in kurotako v1')`. This feature replaces
  that branch.
- [`src/dmmf/model.ts`](../../../../packages/parser-prisma/src/dmmf/model.ts) — the
  mode-neutral `PrismaModel` / `PrismaEntity` / `PrismaField` / `PrismaRelationEdge` /
  `PrismaEnum` records. Docstring already states it is meant to be produced by "the
  deferred Prisma 8 `contract.json` reader … without touching the mapping layer".
- [`src/map/build.ts`](../../../../packages/parser-prisma/src/map/build.ts),
  [`map/scalars.ts`](../../../../packages/parser-prisma/src/map/scalars.ts),
  [`map/defaults.ts`](../../../../packages/parser-prisma/src/map/defaults.ts),
  [`map/relations.ts`](../../../../packages/parser-prisma/src/map/relations.ts) — consume only
  `PrismaModel`. Reused unchanged **if** the contract reader emits the same shape (see
  "PrismaModel gaps" below for the two exceptions).
- [`src/options.ts`](../../../../packages/parser-prisma/src/options.ts) — `v.strictObject`
  with `schema` + `version: v.picklist([7, 8])`.
- [`src/errors.ts`](../../../../packages/parser-prisma/src/errors.ts) — `PrismaInputError`,
  `PrismaPeerMissingError`, `PrismaSchemaError`, all `extends TakoError`.
- `package.json`: peer `@prisma/internals` `>=5 <8` (optional), dev `@prisma/dmmf` +
  `@prisma/internals` `7.10.0`.

Everything under `dmmf/load.ts` (peer resolution, `getDMMF`) stays mode-7-only and
untouched.

## What Prisma 8 changes

Prisma 8 (in RC `8.0.0-rc.x` at design time) drops the DSL/DMMF pipeline. The user authors
a PSL contract (`prisma/contract.prisma`), runs `prisma contract emit`, and gets a
deterministic **`contract.json`** (+ `contract.d.ts`, which kurotako ignores — the JSON is
canonical). Documented shape (partial — see spike below):

```json
{
  "schemaVersion": "1",
  "targetFamily": "sql",
  "target": "postgres",
  "domain": {
    "namespaces": {
      "public": {
        "models": {
          "User": {
            "fields": {
              "id":    { "nullable": false, "type": { "kind": "scalar", "codecId": "pg/uuid@1" } },
              "email": { "nullable": false, "type": { "kind": "scalar", "codecId": "pg/text@1" } }
            },
            "relations": {
              "posts": {
                "cardinality": "1:N",
                "to": { "namespace": "public", "model": "Post" },
                "on": { "localFields": ["id"], "targetFields": ["userId"] }
              }
            }
          }
        }
      }
    }
  },
  "storage": { "…": "tables, columns, native types, primary keys, uniques, indexes, foreign keys" },
  "capabilities": { "…": "" },
  "execution": { "…": "" }
}
```

Confirmed facts driving the design:

- **Field type** = `{ kind: 'scalar', codecId: 'pg/text@1' }`. The codec names the
  encode/decode strategy; it is **dialect-prefixed** (`pg/…`, `mysql/…`, `mongo/…`).
- **Namespaces** are first-class: `domain.namespaces.<ns>.models.<Model>`. A contract can
  hold several namespaces.
- **Relations** carry `cardinality` as `"1:1" | "1:N" | "N:1" | "N:M"` and
  `on.localFields` / `on.targetFields`.
- **No implicit m2m.** "Many-to-many relations go through an explicit join model with a
  composite primary key." The join entity is always a real model in the contract → the
  mode-7 `materialiseM2M` path is never exercised in mode 8.
- **Enums** declare a storage codec via `@@type` and list members
  (`Low = "low"`); member name is the stored value when no value is given.
- **`type` blocks** (value objects, ex-composite types) — structured, no table. Map to
  `FieldType { kind: 'unknown' }`, same as the mode-7 treatment of composite types
  ([Accepted limitations](../parser-prisma/technical.md)).
- **`domain` vs `storage` split**: `domain` is the logical model (names, nullability,
  relations); `storage` holds tables/columns/native types/keys/indexes/FKs. Constraints
  like `maxLength` (from `@db.VarChar(n)`) and non-unique indexes live in `storage` and
  must be joined back to the domain field via each model's `storage` bridge block.

Sources: [What is Prisma 8?](https://www.prisma.io/docs/orm),
[The data contract](https://www.prisma.io/docs/orm/contract-authoring/the-data-contract),
[The contract artifacts](https://www.prisma.io/docs/orm/v8/contract-authoring/the-contract-artifact),
[Author the contract in PSL](https://www.prisma.io/docs/orm/contract-authoring/psl-syntax).

## Spike first (task #1)

The public docs give only excerpts. As with spike #59
for `getDMMF`, the first task emits a real `contract.json` from a Prisma 8 RC project
(PostgreSQL) covering every case kurotako maps, and records the **verbatim** structure for:

- field: exact key path, `codecId` set actually emitted for `pg`, how `list`/array is
  encoded, how `optional` (PSL `?`) differs from `nullable`, `default` representation
  (DB function vs Prisma-generated `uuid()`/`cuid()`), `@map` field-level db name;
- model: `@@id` / `@id`, `@unique` / `@@unique`, `@@index` (+ index type), `@@map`, `///`
  doc comments — and **which block** (`domain` or `storage`) each lands in;
- relations: the four `cardinality` strings, referential actions (`onDelete`/`onUpdate`)
  key names and value vocabulary, explicit join model shape for `N:M`;
- enums: `@@type` codec, members with/without explicit values, `///` doc, `@@map`;
- `type` blocks: how a value-object field is referenced;
- top level: exact `schemaVersion` value, `target` / `targetFamily` values for pg.

Output: a short findings doc appended to this file (a `## Spike findings` section) plus a
committed `contract.json` fixture under `src/contract/__fixtures__/`. Nothing else in the
task breakdown is finalised until this lands — the sections below are the intended shape,
to be reconciled with the findings.

## Spike findings

Captured against the `prisma` CLI meta-package `8.0.0-rc.13` (`npm view prisma dist-tags.latest`,
published ~6 days before this spike — the `next` dist-tag pointed at the older `8.0.0-rc.10` and
was not used for the final capture). **Re-verified against `latest`**: the `prisma` CLI
meta-package and the PostgreSQL engine that actually compiles PSL into `contract.json` are
versioned independently. `prisma@8.0.0-rc.13` transitively resolves `@prisma/orm-postgres` (and
its `@prisma/orm-toolchain` PSL interpreter dependency) to `8.0.0-rc.9` — confirmed against the
npm registry directly (`@prisma/orm-postgres` `dist-tags.latest = 8.0.0-rc.9`; no `rc.10`–`rc.13`
of that package exists). Re-emitting the exact same fixture `contract.prisma` through the
`prisma@8.0.0-rc.13` CLI produced a **byte-identical** `contract.json` (empty diff) to the one
captured through `prisma@next` (`rc.10`), since both resolve the same `8.0.0-rc.9` engine. All
findings below are therefore current as of the latest published PostgreSQL contract engine at
spike time, independent of which CLI meta-package version triggers `contract emit`. PostgreSQL
target, `prisma orm init --target postgres --authoring psl` scaffold, `prisma contract
emit`. Contract source and emitted `contract.json` are committed verbatim as
[`src/contract/__fixtures__/contract.prisma`](../../../../packages/parser-prisma/src/contract/__fixtures__/contract.prisma)
and [`contract.json`](../../../../packages/parser-prisma/src/contract/__fixtures__/contract.json)
(1391 lines). The fixture exercises every case listed in "Spike first" above except
`@@index([...], where: ...)` partial indexes and `cuid()`/`ulid()`/`nanoid()` generators
(only `uuid()`, `autoincrement()`, `now()` were exercised; the others share the same
`execution.mutations.defaults` shape per the CLI's accepted-defaults list, not re-verified
here). Reproduction: `prisma orm init` scaffolds `prisma.config.ts` +
`src/prisma/contract.prisma`; the fixture `contract.prisma` was dropped in verbatim and
emitted with `prisma contract emit --output-path <dir>`.

### Top level

- `schemaVersion`: the string `"1"` (not a semver, not the Prisma package version).
- `target`: `"postgres"`. `targetFamily`: `"sql"`.
- No field anywhere in `contract.json` carries the emitting Prisma package version
  (`8.0.0-rc.10`). `profileHash` / `storageHash` / `executionHash` are content hashes of
  the contract shape, not versions. **`generatorVersion` has no source in the contract** —
  the `parser.ts` sketch's `prisma-contract0{generatorVersion}` fallback to
  `schemaVersion` is the only viable option; there is no better field to prefer over it.
- A `roots` top-level map exists, keyed by **table name** (post-`@@map`), not by model
  name: `roots.app_user = { model: 'User', namespace: 'public' }`. Not needed by kurotako
  (it walks `domain.namespaces` directly, keyed by model name), but a trap if anyone is
  tempted to use `roots` for iteration — it's storage-keyed and only lists SQL root
  entities (tables), not `valueObjects`.

### Field / codec

- Path confirmed: `domain.namespaces.<ns>.models.<Model>.fields.<field>.{nullable,type}`.
  `type.kind` is `'scalar'` for plain scalars, `'valueObject'` for a `type {}` block
  reference (`{ kind: 'valueObject', name: 'Address' }` — **not** `'unknown'` as the
  "speculative" section below assumed; Prisma 8 has a first-class representation).
- `codecId` set actually emitted for pg, from `pg/int4@1` (int4/int8/int2), `pg/text@1`,
  `pg/bool@1`, `pg/numeric@1`, `pg/jsonb@1` (value objects), `pg/timestamptz-temporal@1`
  (see *Temporal* below). A full name list, pulled from the installed
  `@prisma/orm-target-postgres` package's codec-id d.ts
  (`node_modules/@prisma/orm-target-postgres/dist/codec-ids-*.d.mts`), not just what the
  fixture exercises: `pg/bit`, `pg/bool`, `pg/bytea`, `pg/char`, `pg/date-string`,
  `pg/date-temporal`, `pg/enum`, `pg/float`, `pg/float4`, `pg/float8`, `pg/inet`,
  `pg/int`, `pg/int2`, `pg/int4`, `pg/int8`, `pg/int8number`, `pg/interval`, `pg/json`,
  `pg/jsonb`, `pg/numeric`, `pg/text`, `pg/text-array`, `pg/timestamp-string`,
  `pg/timestamp-temporal`, `pg/timestamptz-string`, `pg/timestamptz-temporal`,
  `pg/time-string`, `pg/time-temporal`, `pg/timetz`, `pg/unboundedint`, `pg/uuid`,
  `pg/varbit`, `pg/varchar`. No `pg/date` / `pg/time` / `pg/timestamp` / `pg/timestamptz`
  bare forms — every temporal codec is disambiguated `-string` vs `-temporal` (see below).
  **This list replaces the codec table drafted under "Package changes" below** — no
  `pg/uuid` was actually emitted for a PSL `String @id @default(uuid())` field (see
  *Generated defaults* below: it stays `pg/text@1`, the `uuid()` codec never surfaces as a
  UUID *type*, only as a *generator*).
- **`@db.VarChar(n)` is gone.** The `@db.X(args)` channel is removed in Prisma 8 PSL; a
  length-carrying type is authored as a bare type constructor in field position —
  `code VarChar(10)` (no `@db.` prefix, no field attribute). It emits
  `codecId: "sql/varchar@1"` (**`sql/` prefix, not `pg/`**) with
  `typeParams: { length: 10 }`, both in `domain.<...>.fields.code.type` and in the
  `storage` column (`nativeType: "character varying"`). **The `namespacePrefix`/dialect
  design in this document assumed every codec is `pg/*`-prefixed and any other prefix is a
  `PrismaDialectError`; `sql/varchar` breaks that binary split** — it needs its own
  branch (family-level codec, not target-level) before `PrismaDialectError` fires on
  anything not literally `pg/`.
- `list`/array (`String[]`): the domain field gets `many: true` alongside `nullable` and
  `type` (no `list`/array wrapper kind). Same `many: true` flag on the storage column.
  Prisma 8 also auto-derives a CHECK constraint
  (`array_position("col", NULL) IS NULL`, name `<table>_<field>_elem_not_null_<hash>`) —
  informational, not needed for the mapping layer.
- `nullable` (PSL `?`) is exactly the domain field's `nullable` key — confirmed distinct
  from `default`/generator presence, which live in `storage.columns[...].default` (DB
  function or literal) or in the **top-level** `execution.mutations.defaults[]` array
  (generator-produced values — see next point). A field can be `nullable: false` and still
  carry no default at all (plain required scalar).
- **`default` representation — three distinct shapes, and the generator case does *not*
  live where the draft assumed:**
  - DB function (`@default(now())`, `@default(autoincrement())`): on the **storage**
    column, `default: { kind: 'function', expression: 'now()' }` /
    `{ kind: 'function', expression: 'autoincrement()' }`.
  - Literal (`@default(false)`, `@default(USER)`): on the **storage** column,
    `default: { kind: 'literal', value: false }` / `{ kind: 'literal', value: 'USER' }`.
  - Prisma-generated (`@default(uuid())`, `@updatedAt`-equivalent — see *Temporal*): **no
    `default` key at all on the storage column.** Instead, a top-level
    `execution.mutations.defaults[]` array entry:
    `{ ref: { namespace, table, column }, onCreate: { kind: 'generator', id: 'uuidv4' } }`
    (and `onUpdate` too, for the updated-at case: `{ id: 'instantNow', kind: 'generator' }`
    on both `onCreate` and `onUpdate`). **This is the single biggest correction to the
    draft**: `contract/read.ts` cannot derive `hasDefaultValue` / "is this a
    Prisma-generated default" from the field or the storage column alone — it must also
    consult `execution.mutations.defaults` and join on `{namespace, table, column}`.
- `@map` field-level: renames only the **storage** side. Domain field key stays the PSL
  name (`fields.fullName`); `storage.fields.fullName.column = "full_name"`; the physical
  column in `storage.namespaces.<ns>.entries.table.<t>.columns` is keyed by the **mapped**
  name (`"full_name"`, not `"fullName"`).

### Temporal (unplanned, breaking finding)

Prisma 8 rc.6+ removed the plain `DateTime` + `@updatedAt` pair the draft assumed.
`@updatedAt` on a `DateTime` field is now a hard parse error
(`PSL_UNSUPPORTED_FIELD_ATTRIBUTE`: *"Use `temporal.updatedAt()` as a field-preset call
instead"*). The working replacement, verified in the fixture:

```prisma
updatedAt temporal.updatedAt()   // no type annotation, no @default wrapper
```

This single call is simultaneously the field's type *and* its generator marker. It emits
`codecId: "pg/timestamptz-temporal@1"`, `nullable: false`, and an
`execution.mutations.defaults[]` entry with **both** `onCreate` and `onUpdate` set to
`{ kind: 'generator', id: 'instantNow' }`. A plain `@default(now())` field (e.g.
`createdAt DateTime @default(now())`) also gets `pg/timestamptz-temporal@1`, but as a
storage-column DB-function default (`{kind:'function', expression:'now()'}`), not an
`execution.mutations` entry. **`isUpdatedAt` therefore is not a field flag anywhere** —
it is derived from `execution.mutations.defaults[ref].onUpdate.id === 'instantNow'`.

The codec suffix is `-temporal` (client reads `Temporal.Instant`) vs `-string` (client
reads a plain string) — this is a per-column authoring choice via distinct type
constructors (`Timestamptz` vs `TimestamptzString` in the TS builder; unclear if PSL
exposes both without extra syntax not covered by the fixture). Only `-temporal` was
exercised. **Not decided by this spike**: whether kurotako's `datetime` IR type should
distinguish the two, or normalise both to `datetime`. Flagged for task #109
(codec-mapping) — recommend normalising both to `datetime` (mode-neutral IR, no JS-value
opinion) unless a concrete need for the distinction surfaces.

### Model attributes

- `@id` / `@@id([a, b])` → `storage.namespaces.<ns>.entries.table.<t>.primaryKey.columns`
  (array, single or composite, **storage plane only** — nothing under `domain`).
- `@unique` (field-level) → `storage...uniques[]` entry `{ columns: ["email"] }`, no
  `name`.
- `@@unique([...], ...)` → same `uniques[]` shape. **Only accepts `map:`, not `name:`**
  — `@@unique([...], name: "x")` is `PSL_INVALID_ATTRIBUTE_SYNTAX` ("received unknown
  argument name"). `map: "user_email_username_unique"` surfaces **verbatim, unhashed**, as
  `uniques[].name`. This is asymmetric with `@@index` (below) — the draft's plan to
  treat `@@unique`/`@@index` uniformly needs a branch: unique constraints have no
  `name:` argument at all, only `map:`.
- `@@index([...], name: "x")` / `@@index([...], map: "x")` / `@@index([...], type:
  "btree", name: "x")` → `storage...indexes[]` entries:
  `{ columns, name: "<prefix>_<8-hex-hash>", prefix: "<given name>", unique: false,
  type?: "btree" }`. `name:` is **hashed** into the physical name (`prefix` keeps the
  literal you gave); `type:` is only present in the JSON when explicitly given — a plain
  `@@index([col])` with no `type:` omits the key entirely (default access method is
  implicit, not spelled out). Auto-generated FK-backing indexes (e.g. `authorId` on `Post`)
  get an auto name (`post_authorId_idx_<hash>`) with no explicit PSL `@@index` needed.
- `@@map("table_name")` on a model renames only `storage...table` (and the physical
  column keys, and `roots`'s key). The **domain** model key (`domain.namespaces.<ns>.
  models.<ModelName>`) always stays the PSL identifier — confirms kurotako can key
  entities by PSL model name and ignore `@@map` entirely except when resolving storage
  joins.
- **`///` doc comments are dropped entirely.** Verified absent from `contract.json` (no
  `doc`/`documentation` key anywhere, `meta: {}`) *and* from `contract.d.ts` (no JSDoc
  blocks). The fixture's model/field/enum/member doc comments (`/// A user account.`,
  `/// The user's login email.`, etc.) produce **zero** trace in the emitted artefacts on
  `prisma@8.0.0-rc.10`. **This invalidates the "doc comments" row of the "Spike first"
  checklist and the corresponding `PrismaEntity.doc` / `PrismaField.doc` mode-8 population
  plan** — there is currently no source to populate `doc` from in contract mode; leave it
  `undefined` for mode 8 (mode 7's DMMF-sourced `doc` is unaffected).

### Relations

- Cardinality strings actually emitted: `"1:1"`, `"1:N"`, `"N:1"`. **`"N:M"` was never
  observed** — an explicit join model (`PostTag`) always lowers to a pair of ordinary
  `N:1`/`1:N` edges (`PostTag.post` is `N:1` to `Post`, `Post.tags` is `1:N` to `PostTag`,
  same for `Tag`). The "N:M" cardinality value in the doc excerpt at the top of this file
  is unconfirmed in this rc — treat the fourth cardinality as theoretical/reserved, not
  something `contract/read.ts` needs to branch on; explicit join models already arrive as
  two `1:N`/`N:1` pairs, matching mode 7's post-`materialiseM2M` shape with **zero** extra
  handling needed.
- `on.localFields` / `on.targetFields` confirmed as-is; both sides always present
  (`Post.author.on = {localFields:['authorId'], targetFields:['id']}`,
  `User.posts.on = {localFields:['id'], targetFields:['authorId']}`).
- `onDelete` / `onUpdate` live on the **storage** foreign key
  (`storage...foreignKeys[].{onDelete,onUpdate}`), not under `domain.relations`. Values
  are lowercased PSL literals: `Cascade → "cascade"`, `Restrict → "restrict"`. A relation
  with no explicit `onDelete`/`onUpdate` in PSL simply omits the key (no default literal
  written out — e.g. `PostTag.post`/`PostTag.tag` both declared `onDelete: Cascade`
  explicitly and got the key; an untested no-explicit-action relation was not captured,
  flagged as an open point for task #110).
- **Relation name resolution across namespaces is a real footgun, verified twice.** In the
  fixture, `Post.author @relation(fields: [authorId], references: [id])` and
  `Profile.user @relation(...)` both reference the bare type name `User`. With only
  `public.User` declared, both resolve to `{model:'User', namespace:'public'}` as
  expected. **After adding a second, unrelated `namespace billing { model User { ... } }`
  block later in the same file, both relations silently re-resolved to
  `{model:'User', namespace:'billing'}`** — the *wrong* namespace, with no diagnostic. PSL
  bare-name relation resolution in this rc is **not scoped to the referencing model's own
  namespace**; it appears to bind to whichever `User` declaration is lexically last/most
  global. **This blocks the "flatten + collision-error" design in this document as
  written**: `PrismaEntityCollisionError` (task #111) catches two models colliding onto
  the *same target name*, but does nothing for two *same-named* models in *different*
  namespaces that never collide by name — the collision here is silent and produces a
  contract that is already wrong before kurotako ever reads it. Recommendation for task
  #111: `contract/read.ts` must **not** trust `to.namespace` at face value when the
  contract contains a homonym model that also has a bare-name relation into it; either (a)
  detect "model name X appears in >1 namespace AND some relation's `to.model === X`" and
  hard-fail with a new `PrismaAmbiguousRelationError` pointing at the Prisma-level
  authoring bug, or (b) treat this as a known, documented Prisma 8 rc limitation and defer
  to a re-check once the CLI stabilises past rc. This is a spike finding about the
  **Prisma CLI's** resolution, not about kurotako's reader — no kurotako code can fix a
  contract that already names the wrong namespace.

### Enums

- Path is `domain.namespaces.<ns>.enum.<EnumName>` — **singular `enum`, not `enums`** (the
  draft used `enums` informally; the real key is `enum`).
- `@@type("pg/text@1")` is required to get a scalar-codec-backed enum in the emitted
  JSON's `codecId` field; without it (bare `enum Foo { A B }`), emit still succeeds and
  produces the exact same shape with `codecId: "pg/text@1"` as the implicit default (rc.10
  defaults every enum to a text codec when none is declared — `@@type` did not change
  the fixture's output in either the with/without case tested, so it may be forward-looking
  syntax for non-text codecs not yet load-bearing on Postgres text-backed enums).
- `@@map(...)` on an `enum` block is **rejected**:
  `PSL_EXTENSION_UNKNOWN_BLOCK_ATTRIBUTE — Unknown attribute "@@map" in "enum" block`.
  **Enums cannot be renamed at the storage level in this rc.** Drop `@@map` from any
  enum-authoring guidance/fixture updates; not something `contract/read.ts` needs to
  handle.
- Members: `{ name: "Low", value: "low" }` when `Low = "low"` is given explicitly;
  `{ name: "USER", value: "USER" }` (name mirrored into value) when no explicit value is
  given — confirms "member name is the stored value when no value is given".
- `///` doc on enum / member: dropped, same as model/field doc comments (see above).
- A field referencing an enum gets, in **domain**: the enum's `codecId` on the field's
  `type`, plus `valueSet: { entityKind: 'enum', entityName: 'UserRole', namespaceId:
  'public', plane: 'domain' }`. The **storage** column mirrors it with
  `valueSet: { entityKind: 'valueSet', entityName: 'UserRole', namespaceId: 'public',
  plane: 'storage' }` and points at `storage.namespaces.<ns>.entries.valueSet.<EnumName>`
  — which holds **only** `{ kind: 'valueSet', values: ["USER", "ADMIN"] }` (raw values,
  member *names* are not repeated on the storage side; only `domain...enum` has both name
  and value per member). Prisma 8 also auto-derives a membership CHECK constraint on the
  column (`"role" IN ('USER', 'ADMIN')`), informational for kurotako.

### Value objects (`type {}` blocks)

`type Address { street String; city String; zip String?; country String }` referenced as
`address Address?` on `User` lowers to:

- `domain.namespaces.<ns>.valueObjects.Address.fields.{street,city,zip,country}` — same
  `{nullable, type}` shape as ordinary model fields, no `id`/relations.
- The referencing field's domain type: `{ kind: 'valueObject', name: 'Address' }` (see
  *Field / codec* above — **not** `'unknown'`).
- Storage column: `codecId: "pg/jsonb@1"`, `nativeType: "jsonb"`. No individual value-object
  field constraints surface in storage (the whole object is one opaque `jsonb` column).

### Named type aliases (`types {}` block, not composite types)

`types { Email = String }`, used as `nickname Email?`, is **distinct** from the `type
Address {}` value-object block above (both use the `type`/`types` keyword family but are
different constructs). It does **not** introduce a `valueObjects`-style entry; instead the
referencing field keeps a plain scalar `type` (`pg/text@1`) and the **storage** column
gains a `typeRef: "Email"` key. The alias itself is recorded once, top-level, at
`storage.types.Email = { kind: 'codec-instance', codecId: 'pg/text@1', nativeType: 'text' }`
— **not** under `domain`. Not required by the current mapping design (the alias resolves
transparently to its underlying scalar codec for `map/scalars.ts` purposes); flagged in
case a future kurotako feature wants to preserve alias names.

### Namespaces

- The working PSL syntax is a **block form**, `namespace billing { model X { ... } }`,
  wrapping one or more models/enums. This is **not** the `@@schema("name")` +
  `datasource { schemas = [...] }` attribute form from pre-Prisma-8 multi-schema docs
  (unconfirmed by web search, not present in the installed rc's PSL grammar as tested — no
  `@@schema` attribute was needed or attempted successfully). No `prisma.config.ts`
  change was needed to add the second namespace.
- Models outside any `namespace {}` block land in an implicit `public` namespace key —
  confirmed by the fixture (`User`, `Post`, etc. all key under `domain.namespaces.public`
  with no explicit `namespace public { ... }` wrapper needed).
- Two-namespace, non-homonym models (`billing.Invoice`, `billing.InvoiceItem`) round-trip
  with no surprises — this part of the "flatten" design in this document is unaffected by
  the relation-resolution finding above, which only bites on same-named models plus a
  bare-name relation into them.

### Reconciliation required before tasks #108–#111 proceed

1. **Codec table** (task #109): replace the drafted `pg/*` table with the confirmed list
   above; add an explicit `sql/varchar@1` (`sql/` prefix, family-level not target-level)
   branch before the blanket "non-`pg/*` prefix → `PrismaDialectError`" rule fires
   incorrectly on it; fold `-string`/`-temporal` codec-suffix normalisation into the
   `datetime` mapping.
2. **Default / generator detection** (task #110, `PrismaModel` gap #2 in "Package
   changes" below): `hasDefaultValue` and `isUpdatedAt` must be derived from
   `execution.mutations.defaults[]` (joined by `{namespace, table, column}`), not from the
   field or storage column alone — the storage column carries **no** `default` key for
   generator-backed defaults.
3. **`doc` population** (task #110): drop the doc-comment-to-`PrismaEntity.doc`/
   `PrismaField.doc` plan for mode 8 — there is no source. Leave `doc: undefined` in
   contract-mode `PrismaModel`s.
4. **`@@unique` vs `@@index` argument asymmetry** (task #110/#111 options surface):
   `@@unique` only takes `map:` (verbatim name); `@@index` takes `name:` (hashed) or
   `map:` (verbatim) — not the same option set. Not a kurotako design decision, just a
   parsing-shape note for whoever writes the fixture-driven tests.
5. **Homonym-across-namespaces relation resolution** (task #111, before finalising the
   collision design): add a guard in `contract/read.ts` for "relation into a model name
   that exists in more than one namespace" — the emitted `to.namespace` cannot be trusted
   at face value in that situation. Needs a decision (new error class vs. documented
   limitation) before task #111's technical breakdown is written.

## Package changes

### `src/contract/` (new)

```
src/contract/
  schema.ts     # Valibot schema for the subset of contract.json kurotako reads
  version.ts    # supported schemaVersion set + PrismaContractVersionError guard
  codecs.ts     # codec-name -> ScalarType / StringFormat table (pg first)
  read.ts       # contract.json (parsed+validated) -> PrismaModel
  read.test.ts
  __fixtures__/  # real emitted contract.json samples (from the spike)
```

- **`schema.ts`** — `v.looseObject` at every level (Prisma will add keys; kurotako must
  not break on them — same lesson as
  [valibot-looseobject](../../../../packages/parser-prisma/src/dmmf/read.ts) elsewhere). Only
  the paths kurotako consumes are typed: `schemaVersion`, `target`, `targetFamily`,
  `domain.namespaces.<ns>.models.<M>.{fields,relations,storage}`, and the relevant
  `storage` sub-tree. Parse failure → `PrismaContractError` (new) carrying the Valibot
  issue path.
- **`version.ts`** — `const SUPPORTED_SCHEMA_VERSIONS = new Set(['1'])` (pinned by the
  spike). `assertSupportedVersion(found)` throws `PrismaContractVersionError` with
  `expected` vs `found` when unknown. Never best-effort.
- **`codecs.ts`** — indexed by **codec name without the `@N` suffix**:

  | Codec name | IR |
  |---|---|
  | `pg/text`, `pg/varchar`, `pg/char`, `pg/citext` | `string` |
  | `pg/varchar(n)` / length-carrying native | `string` + `constraints.maxLength = n` (from `storage`) |
  | `pg/bool` | `boolean` |
  | `pg/int2`, `pg/int4` | `int` |
  | `pg/int8` | `bigint` |
  | `pg/float4`, `pg/float8` | `float` |
  | `pg/numeric` | `decimal` |
  | `pg/uuid` | `uuid` |
  | `pg/timestamp`, `pg/timestamptz` | `datetime` |
  | `pg/date` | `date` |
  | `pg/time`, `pg/timetz` | `datetime` + `constraints.format = 'time'` |
  | `pg/jsonb`, `pg/json` | `json` |
  | `pg/bytea` | `bytes` |
  | unknown `pg/*` | `FieldType { kind: 'unknown', hint: codecId }` + `debug` log |
  | non-`pg/*` prefix | `PrismaDialectError` (fail fast, whole parse) |

  The real codec-name list is confirmed by the spike; this table is the target. The
  `@N` version is parsed off, logged at `debug`, and does not affect the lookup.

- **`read.ts`** — walks `domain.namespaces`, flattens **all** namespaces into one flat
  entity list (overview: 1 contract = 1 kurotako namespace), applies the rename/prefix
  policy (below), joins each field to its `storage` column for native-type constraints and
  keys, and emits `PrismaModel`. Pure, total, no disk, no `@prisma/*` import.

### `src/options.ts`

```ts
export const PrismaParserOptions = v.strictObject({
  schema: v.optional(v.string(), './prisma/schema.prisma'),
  version: v.optional(v.picklist([7, 8])),
  // mode 8: prefix every entity of a Prisma namespace. Ignored (warn) in mode 7.
  namespacePrefix: v.optional(v.record(v.string(), v.string())),
  // both modes: rename one entity. Mode 8 key = 'namespace.Entity'; mode 7 key = 'Entity'.
  rename: v.optional(v.record(v.string(), v.string())),
})
```

Both new keys are validated in every mode; `namespacePrefix` set in mode 7 logs a
`warn` and is otherwise ignored ([overview](overview.md) "Portée des options").

**Rename / prefix resolution** (in `contract/read.ts`, mode 8):

1. Collect `(namespace, modelName)` for every model.
2. Target name = `rename['<ns>.<Model>']` if present, else
   `(namespacePrefix['<ns>'] ?? '') + modelName`.
3. After resolution, if two models still map to the same target name →
   `PrismaEntityCollisionError` listing every colliding `<ns>.<Model>` pair and the
   winning name. No silent last-wins.
4. Relation `to.model` / `to.namespace` are rewritten through the same map so
   `Relation.target.entity` stays consistent.

In mode 7, `dmmf/read.ts` gains a final pass applying `rename['<Entity>']` to entity names
and relation targets (prefix map inert — no namespaces).

### `src/errors.ts` (new classes)

All `extends TakoError`, surfaced by core as `DriverError`:

| Class | `code` | When |
|---|---|---|
| `PrismaContractError` | `prisma_contract` | `contract.json` is not valid JSON, or fails the Valibot schema |
| `PrismaContractVersionError` | `prisma_contract_version` | `schemaVersion` not in the supported set (message: expected vs found) |
| `PrismaDialectError` | `prisma_dialect` | a codec prefix other than `pg/` is seen (message names the dialect + points at the pg-only limitation) |
| `PrismaEntityCollisionError` | `prisma_entity_collision` | two contract models collapse to one entity name after rename/prefix |

`PrismaInputError` (missing path, bad extension) is reused from mode-8 detection, already
wired in `detect.ts`.

### `src/parser.ts`

Replace the throwing mode-8 branch:

```ts
if (input.mode === 8) {
  const raw = await readFile(input.contractPath, 'utf8')
  const { model, generatorVersion } = readContract(raw, ctx, options)   // contract/read.ts
  return buildSourceIR(ctx.namespace, model, `prisma-contract@${generatorVersion}`, ctx.logger)
}
```

`generatorVersion` comes from a field in `contract.json` (the emitting Prisma version, or
`schemaVersion` as fallback — spike confirms). `watchPaths` / `anchor` already handle the
`contract.json` path ([parser.ts:46-58](../../../../packages/parser-prisma/src/parser.ts)) —
no change.

### `PrismaModel` gaps (`dmmf/model.ts`)

Two shape mismatches to resolve so mode 8 can reuse `map/`:

1. **Relation cardinality.** Mode 7 derives owning/back sides from DMMF edges
   (`fromFields` on the owning side). The contract gives `cardinality` (`1:N` etc.) and a
   single `on` block. `contract/read.ts` synthesises the two `PrismaRelationEdge`s
   (owning side = the one whose model holds `on.localFields` as FK per `storage`), so
   `map/relations.ts:buildRelations` keeps working unchanged. `1:N` / `N:1` map to
   `isList` on the correct side; `N:M` yields the explicit-join-model edges directly (no
   `isImplicitM2M` match — both sides carry `fromFields`).
2. **`nullable` vs `optional`.** Mode 7: `nullable ← !isRequired`,
   `optional ← hasDefaultValue || isUpdatedAt`
   ([build.ts:154-159](../../../../packages/parser-prisma/src/map/build.ts)). The contract
   distinguishes PSL `?` (`nullable: true`) from "has a default". `contract/read.ts` sets
   `PrismaField.isRequired = !nullable` and `hasDefaultValue` from the presence of
   `default`; `isUpdatedAt` from the contract's updated-at marker (spike). No `map/`
   change.

`indexes` / `uniques` / `primaryKey` / `dbName` / `doc` already exist on `PrismaEntity`
and are populated from `storage`. No new `PrismaModel` field is expected; if the spike
finds one truly unavoidable, it is added as optional and mode 7 leaves it unset.

## Dependencies

- **No new runtime dependency.** Mode 8 is `node:fs/promises` + `valibot` (already a dep)
  + plain object walking. Zero `@prisma/*`.
- **Dev**: add `prisma@8` (RC) as a `devDependency` to emit fixtures in the spike and in
  a smoke test. `@prisma/internals` / `@prisma/dmmf` `7.10.0` stay for mode-7 tests.
- **Peer**: `@prisma/internals` stays `>=5 <8`, still `optional` — mode 8 does not touch
  it, mode 7 keeps its current contract. No bump (`<8` is deliberate:
  spike #59 chose it, and Prisma 8's
  `@prisma/internals` — if it ships — has a different API kurotako does not use).

## Tests (vitest, colocated)

Fixture-driven, mirroring the mode-7 suite
([parser-prisma/technical.md §Tests](../parser-prisma/technical.md)):
real `contract.json` samples → `readContract` → `PrismaModel` → `buildSourceIR`, asserting
the `SourceIR` structure.

- **codecs**: every mapped `pg/*` codec → expected `ScalarType`; `pg/varchar` +
  `storage` length → `maxLength`; `pg/uuid` → `uuid`; `pg/time` → `datetime` +
  `format: 'time'`; unknown `pg/foo` → `unknown` with hint; `mysql/*` → `PrismaDialectError`.
- **`@N` tolerance**: `pg/text@1` and a synthetic `pg/text@2` both map to `string`.
- **nullable/optional**: `String?` → `nullable`, not `optional`; field with a DB default
  → `optional`; updated-at marker → `optional`.
- **keys**: `@id` → `primaryKey`; `@@id([a,b])` → composite; `@unique` →
  `constraints.unique`; `@@unique([a,b])` → `Entity.uniques`; `@@index` (+ type) →
  `Entity.indexes` (mode 8 actually has these, unlike mode-7 DMMF).
- **relations**: `1:1`, `1:N` (owning side has `fkFields`/`references`, other side
  `backRelation`), `N:1`, referential actions; `N:M` explicit join model → two `1:N`
  relations, join entity emitted verbatim, **no synthetic entity**.
- **enums**: `@@type` codec ignored for the IR value list; members with/without explicit
  value; `///` doc; `@@map`.
- **namespaces / collisions**: two Prisma namespaces, no collision → flat entity set;
  colliding `User` in `public` + `billing` → `PrismaEntityCollisionError`;
  `namespacePrefix: { billing: 'Billing' }` resolves it; `rename` overrides prefix;
  relation targets rewritten consistently.
- **version**: `schemaVersion: '1'` OK; `'2'` → `PrismaContractVersionError`.
- **errors**: non-JSON → `PrismaContractError`; schema-invalid contract →
  `PrismaContractError` with issue path; missing `contract.json` → `PrismaInputError`
  (already covered in `detect.test.ts`).
- **determinism**: same contract parsed twice → deep-equal `SourceIR`; entity/field order
  stable regardless of namespace iteration order.
- **mode-7 rename**: `rename: { 'User': 'AppUser' }` applied in DMMF mode;
  `namespacePrefix` in mode 7 → `warn`, no effect.

## Alternatives considered

- **Parser emits the contract itself** (bundle Prisma 8 tooling, run `contract emit`).
  Rejected ([overview](overview.md)): reintroduces a heavy `@prisma/*` dependency and a
  build step kurotako deliberately shed for this mode. The user runs `prisma contract
  emit`; kurotako reads the artifact.
- **Map Prisma namespaces onto namespaced IR identifiers.** Rejected ([overview](overview.md)):
  contradicts "generated identifiers are never prefixed"
  ([docs/architecture.md](../../../../docs/architecture.md)). Flatten + opt-in rename/prefix
  instead.
- **Error on any multi-namespace contract in v1.** Rejected: the flatten + collision-error
  path already makes multi-namespace safe by default, and the rename/prefix escape hatch
  is cheap.
- **Exact `codecId` match (`pg/text@1`).** Rejected ([overview](overview.md)): every codec
  version bump would demote fields to `unknown` and spam warnings. Match on name, tolerate
  `@N`.
- **Design the reader fully from the docs, no spike.** Rejected ([overview](overview.md)):
  the public contract schema is incomplete and Prisma 8 is RC; a captured fixture is the
  ground truth, exactly as spike #59
  did for `getDMMF`.
- **New `@kurotako/parser-prisma8` package.** Rejected in v1 already
  ([parser-prisma/overview.md](../parser-prisma/overview.md)): one
  package, one `prisma` config key, internal version mode.

## Consequences verified against the repo

- [`src/parser.ts:29-35`](../../../../packages/parser-prisma/src/parser.ts) — the only
  behavioural change to existing code: the mode-8 `throw` becomes the real path.
- [`src/detect.ts`](../../../../packages/parser-prisma/src/detect.ts) — **no change**. Mode-8
  resolution and its `detect.test.ts` cases already pass.
- [`src/dmmf/model.ts`](../../../../packages/parser-prisma/src/dmmf/model.ts) — likely no
  change; at most one new optional field. The file is misnamed for a shared shape
  (`dmmf/`), but renaming `dmmf/model.ts` → `model.ts` at package root touches every
  importer — **out of scope**, noted as a follow-up cleanup.
- [`src/map/*`](../../../../packages/parser-prisma/src/map) — **no change** if
  `contract/read.ts` honours the `PrismaModel` contract (the two gaps above are handled in
  the reader, not the mapper). `map/relations.ts:isImplicitM2M`
  ([relations.ts:63-73](../../../../packages/parser-prisma/src/map/relations.ts)) simply never
  matches in mode 8.
- [`src/options.ts`](../../../../packages/parser-prisma/src/options.ts) — two optional keys
  added; `v.strictObject` still rejects typos. Existing configs unaffected (both keys
  optional).
- [`src/index.ts`](../../../../packages/parser-prisma/src/index.ts) — export the four new
  error classes alongside the existing three.
- `package.json` — `prisma@8` devDep added; peer range untouched.
- **Changeset**: required — new public behaviour (`contract.json` support) and new
  exported error classes on a published package
  ([.changeset/README.md](../../../../.changeset/README.md)). `minor` bump.
- **Docs**: `apps/docs` parser-prisma page and
  [docs/architecture.md](../../../../docs/architecture.md) mention "Prisma 8 mode deferred" —
  reconcile when this lands (doc-only, not this phase).
- [generator-zod](../generator-zod/overview.md) and other downstream
  generators are **unaffected**: they consume `SourceIR`, which is identical between modes.

## Découpage en tâches d'implémentation

GitHub issues are tracked in `marmotz/kurotako`.

1. #107 prisma8-contract-spike — émettre un
   vrai `contract.json` (Prisma 8 RC, PostgreSQL), committer la fixture, consigner la
   structure verbatim dans ce document. Bloque tout le reste.
2. #108 prisma8-contract-schema —
   `src/contract/schema.ts` (Valibot `looseObject`), `version.ts` (guard `schemaVersion`),
   4 classes d'erreur, ré-exports, devDep `prisma@8` (dep : #107).
3. #109 prisma8-codec-mapping —
   `src/contract/codecs.ts` : table codec `pg/*` → `ScalarType` / `format`, tolérance
   `@N`, `PrismaDialectError` (deps : #107, #108).
4. #110 prisma8-contract-reader —
   `src/contract/read.ts` : `contract.json` → `PrismaModel` (aplatissement des
   namespaces, jointure `storage`, synthèse des edges de relation, `nullable`/`optional`)
   (deps : #108, #109).
5. #111 prisma8-options-and-wiring —
   options `namespacePrefix` / `rename` + `src/contract/naming.ts` (résolution +
   `PrismaEntityCollisionError`), passe rename mode 7, branchement mode 8 dans
   `parser.ts`, tests end-to-end, changeset `minor` (deps : #108, #110).
