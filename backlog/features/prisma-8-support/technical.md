# Prisma 8 support — technical design

Design for adding the **Prisma 8 mode** to `@kurotako/parser-prisma`. Product decisions
come from [overview.md](overview.md). The IR produced is unchanged
([`@kurotako/ir`](../../_archives/features/ir-model/technical.md)); the driver contract is
unchanged ([`@kurotako/config`](../../_archives/features/config-system/technical.md) /
[`@kurotako/core`](../../_archives/features/core-pipeline/technical.md)). This document
turns the overview into a `contract.json` → `PrismaModel` reader plugged behind the
existing version-mode seam.

## Starting point (current code)

The v1 parser already ships the seam this feature fills in:

- [`src/detect.ts`](../../../packages/parser-prisma/src/detect.ts) — `resolveInput()`
  returns `{ mode: 7, … }` or `{ mode: 8, kind: 'contract', contractPath }`
  ([detect.ts:17-19](../../../packages/parser-prisma/src/detect.ts)). Mode 8 detection
  (`contract.json` file, or a folder containing one, or `version: 8`) is **already
  implemented and tested** ([detect.ts:102-161](../../../packages/parser-prisma/src/detect.ts)).
- [`src/parser.ts:29-35`](../../../packages/parser-prisma/src/parser.ts) — mode 8 currently
  throws `PrismaInputError('… not implemented in kurotako v1')`. This feature replaces
  that branch.
- [`src/dmmf/model.ts`](../../../packages/parser-prisma/src/dmmf/model.ts) — the
  mode-neutral `PrismaModel` / `PrismaEntity` / `PrismaField` / `PrismaRelationEdge` /
  `PrismaEnum` records. Docstring already states it is meant to be produced by "the
  deferred Prisma 8 `contract.json` reader … without touching the mapping layer".
- [`src/map/build.ts`](../../../packages/parser-prisma/src/map/build.ts),
  [`map/scalars.ts`](../../../packages/parser-prisma/src/map/scalars.ts),
  [`map/defaults.ts`](../../../packages/parser-prisma/src/map/defaults.ts),
  [`map/relations.ts`](../../../packages/parser-prisma/src/map/relations.ts) — consume only
  `PrismaModel`. Reused unchanged **if** the contract reader emits the same shape (see
  "PrismaModel gaps" below for the two exceptions).
- [`src/options.ts`](../../../packages/parser-prisma/src/options.ts) — `v.strictObject`
  with `schema` + `version: v.picklist([7, 8])`.
- [`src/errors.ts`](../../../packages/parser-prisma/src/errors.ts) — `PrismaInputError`,
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
  ([Accepted limitations](../../_archives/features/parser-prisma/technical.md)).
- **`domain` vs `storage` split**: `domain` is the logical model (names, nullability,
  relations); `storage` holds tables/columns/native types/keys/indexes/FKs. Constraints
  like `maxLength` (from `@db.VarChar(n)`) and non-unique indexes live in `storage` and
  must be joined back to the domain field via each model's `storage` bridge block.

Sources: [What is Prisma 8?](https://www.prisma.io/docs/orm),
[The data contract](https://www.prisma.io/docs/orm/contract-authoring/the-data-contract),
[The contract artifacts](https://www.prisma.io/docs/orm/v8/contract-authoring/the-contract-artifact),
[Author the contract in PSL](https://www.prisma.io/docs/orm/contract-authoring/psl-syntax).

## Spike first (task #1)

The public docs give only excerpts. As with [spike #59](../../_archives/tasks/59-prisma-getdmmf-spike.md)
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
  [valibot-looseobject](../../../packages/parser-prisma/src/dmmf/read.ts) elsewhere). Only
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
`contract.json` path ([parser.ts:46-58](../../../packages/parser-prisma/src/parser.ts)) —
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
   ([build.ts:154-159](../../../packages/parser-prisma/src/map/build.ts)). The contract
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
  [spike #59](../../_archives/tasks/59-prisma-getdmmf-spike.md) chose it, and Prisma 8's
  `@prisma/internals` — if it ships — has a different API kurotako does not use).

## Tests (vitest, colocated)

Fixture-driven, mirroring the mode-7 suite
([parser-prisma/technical.md §Tests](../../_archives/features/parser-prisma/technical.md)):
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
  ([docs/architecture.md](../../../docs/architecture.md)). Flatten + opt-in rename/prefix
  instead.
- **Error on any multi-namespace contract in v1.** Rejected: the flatten + collision-error
  path already makes multi-namespace safe by default, and the rename/prefix escape hatch
  is cheap.
- **Exact `codecId` match (`pg/text@1`).** Rejected ([overview](overview.md)): every codec
  version bump would demote fields to `unknown` and spam warnings. Match on name, tolerate
  `@N`.
- **Design the reader fully from the docs, no spike.** Rejected ([overview](overview.md)):
  the public contract schema is incomplete and Prisma 8 is RC; a captured fixture is the
  ground truth, exactly as [spike #59](../../_archives/tasks/59-prisma-getdmmf-spike.md)
  did for `getDMMF`.
- **New `@kurotako/parser-prisma8` package.** Rejected in v1 already
  ([parser-prisma/overview.md](../../_archives/features/parser-prisma/overview.md)): one
  package, one `prisma` config key, internal version mode.

## Consequences verified against the repo

- [`src/parser.ts:29-35`](../../../packages/parser-prisma/src/parser.ts) — the only
  behavioural change to existing code: the mode-8 `throw` becomes the real path.
- [`src/detect.ts`](../../../packages/parser-prisma/src/detect.ts) — **no change**. Mode-8
  resolution and its `detect.test.ts` cases already pass.
- [`src/dmmf/model.ts`](../../../packages/parser-prisma/src/dmmf/model.ts) — likely no
  change; at most one new optional field. The file is misnamed for a shared shape
  (`dmmf/`), but renaming `dmmf/model.ts` → `model.ts` at package root touches every
  importer — **out of scope**, noted as a follow-up cleanup.
- [`src/map/*`](../../../packages/parser-prisma/src/map) — **no change** if
  `contract/read.ts` honours the `PrismaModel` contract (the two gaps above are handled in
  the reader, not the mapper). `map/relations.ts:isImplicitM2M`
  ([relations.ts:63-73](../../../packages/parser-prisma/src/map/relations.ts)) simply never
  matches in mode 8.
- [`src/options.ts`](../../../packages/parser-prisma/src/options.ts) — two optional keys
  added; `v.strictObject` still rejects typos. Existing configs unaffected (both keys
  optional).
- [`src/index.ts`](../../../packages/parser-prisma/src/index.ts) — export the four new
  error classes alongside the existing three.
- `package.json` — `prisma@8` devDep added; peer range untouched.
- **Changeset**: required — new public behaviour (`contract.json` support) and new
  exported error classes on a published package
  ([.changeset/README.md](../../../.changeset/README.md)). `minor` bump.
- **Docs**: `apps/docs` parser-prisma page and
  [docs/architecture.md](../../../docs/architecture.md) mention "Prisma 8 mode deferred" —
  reconcile when this lands (doc-only, not this phase).
- [generator-zod](../../_archives/features/generator-zod/overview.md) and other downstream
  generators are **unaffected**: they consume `SourceIR`, which is identical between modes.

## Découpage en tâches d'implémentation

Fichiers sous [`../../tasks/`](../../tasks/), issues sur `marmotz/kurotako`.

1. [#107 prisma8-contract-spike](../../tasks/107-prisma8-contract-spike.md) — émettre un
   vrai `contract.json` (Prisma 8 RC, PostgreSQL), committer la fixture, consigner la
   structure verbatim dans ce document. Bloque tout le reste.
2. [#108 prisma8-contract-schema](../../tasks/108-prisma8-contract-schema.md) —
   `src/contract/schema.ts` (Valibot `looseObject`), `version.ts` (guard `schemaVersion`),
   4 classes d'erreur, ré-exports, devDep `prisma@8` (dep : #107).
3. [#109 prisma8-codec-mapping](../../tasks/109-prisma8-codec-mapping.md) —
   `src/contract/codecs.ts` : table codec `pg/*` → `ScalarType` / `format`, tolérance
   `@N`, `PrismaDialectError` (deps : #107, #108).
4. [#110 prisma8-contract-reader](../../tasks/110-prisma8-contract-reader.md) —
   `src/contract/read.ts` : `contract.json` → `PrismaModel` (aplatissement des
   namespaces, jointure `storage`, synthèse des edges de relation, `nullable`/`optional`)
   (deps : #108, #109).
5. [#111 prisma8-options-and-wiring](../../tasks/111-prisma8-options-and-wiring.md) —
   options `namespacePrefix` / `rename` + `src/contract/naming.ts` (résolution +
   `PrismaEntityCollisionError`), passe rename mode 7, branchement mode 8 dans
   `parser.ts`, tests end-to-end, changeset `minor` (deps : #108, #110).
