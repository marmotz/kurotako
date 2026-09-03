# Prisma parser — technical design

Design for `@kurotako/parser-prisma`. Product decisions come from [overview.md](overview.md);
the IR it must produce is [`@kurotako/ir`](../ir-model/technical.md) and the driver contract
it must satisfy is [`@kurotako/config`](../config-system/technical.md) /
[`@kurotako/core`](../core-pipeline/technical.md). This document turns the overview into a
concrete package, a DMMF → `SourceIR` mapping, and a version-mode seam.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) scaffolds
  `packages/parser-prisma/` with a single `src/index.ts` exporting a `version` const and one
  trivial test. This feature replaces that placeholder with the real driver.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API** — disk access uses `node:fs/promises`.
- Upstream contracts already designed:
  - [`@kurotako/ir`](../ir-model/technical.md) exposes the `SourceIR` type and the fluent
    `createSourceIR({ namespace, parser, parserVersion? })` builder with incremental
    validation ([ir-model/technical.md §Builder](../ir-model/technical.md#builder-builderts)).
    The parser assembles its output **only** through that builder.
  - [`@kurotako/core`](../core-pipeline/technical.md) declares `ParseContext`
    (`{ namespace, cwd, logger }`) and calls `parser.parse(ctx)` once per source, in sorted
    namespace order, then `validateSourceIR` on the result
    ([core-pipeline/technical.md §Orchestration step 1](../core-pipeline/technical.md#orchestration-algorithm-runts)).
  - [`@kurotako/config`](../config-system/technical.md) defines the public shape of a
    driver: a `TakoParser<O>` **object** with `name`, an optional Valibot `optionsSchema`,
    and `parse(ctx, options)`. `@kurotako/config` validates `options` against
    `optionsSchema` and **curries it away** before handing core a plain `Parser`
    ([config-system/technical.md §Config shape](../config-system/technical.md#config-shape-and-defineconfig-typests-definets)).
- Relevant ADRs:
  [ADR-0003](../../../docs/adr/0003-multiple-parsers-namespaces.md) (namespace = config key,
  one parser package instantiated several times),
  [ADR-0004](../../../docs/adr/0004-ir-namespace-first.md) (key `(namespace, entity)`,
  deterministic identifiers, no homonym merge),
  [ADR-0006](../../../docs/adr/0006-parser-generator-vocabulary.md) (`parser` role, package
  name `@kurotako/parser-<x>`).

## Package shape

Single entry point (keeps the `exports` map identical to the bootstrap skeleton and to what
mode B emits — [ADR-0005](../../../docs/adr/0005-output-modes.md)).

```
packages/parser-prisma/src/
  index.ts          # barrel: prismaParser + public types
  parser.ts         # prismaParser: TakoParser<PrismaParserOptions>
  options.ts        # Valibot PrismaParserOptions schema + defaults
  detect.ts         # resolveInput(): schema path(s) -> { mode, files }
  map/
    build.ts        # SourceIR assembly shared by both modes (drives createSourceIR)
    scalars.ts      # Prisma type + native @db.* type -> ScalarType + Constraints
    relations.ts    # relation pairing, owning side, implicit-m2m materialisation
    defaults.ts     # Prisma default -> IR DefaultValue
  dmmf/
    load.ts         # getDMMF wrapper (Prisma <= 7 mode)
    read.ts         # DMMF.Document -> the mode-neutral shape consumed by map/build.ts
  contract/         # Prisma 8 mode - deferred past kurotako v1 (see below)
    read.ts         # placeholder: contract.json -> the same mode-neutral shape
  *.test.ts
```

### Dependencies

| Dep | Kind | Why |
|---|---|---|
| `@kurotako/ir` | `dependencies` (`workspace:*`) | `createSourceIR` builder + `SourceIR` / `ScalarType` / `StringFormat` types, used at runtime |
| `@kurotako/core` | `peerDependencies` + `devDependencies` (`workspace:*`) | `ParseContext` **type** only (always present via the CLI) |
| `@kurotako/config` | `peerDependencies` + `devDependencies` (`workspace:*`) | `TakoParser` **type** only |
| `valibot` | `dependencies` | `optionsSchema` |
| `@prisma/internals` | **`peerDependencies`** (`>=5 <8`, pinned by [spike #59](../../tasks/59-prisma-getdmmf-spike.md)) | `getDMMF` in the Prisma ≤ 7 mode. **Decided**: reading the DMMF with the project's own Prisma keeps the parse aligned with the user's schema semantics. A clear `PrismaPeerMissingError` with an install hint is thrown when it cannot be resolved. See [Spike #59 findings](#spike-59-findings-getdmmf) — on Prisma 7 the peer no longer resolves transitively and the hint (`add @prisma/internals@7 as a devDependency`) is the nominal path. |

- `tsconfig.json` `references`: `[{ "path": "../ir" }, { "path": "../core" }, { "path": "../config" }]`
  — [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) step 2 already mandates a
  reference per imported internal package; this feature pins the exact list (small
  consequence for #6, noted below).
- `"sideEffects": false`.

## Public contract (`parser.ts` + `options.ts`)

```ts
import * as v from 'valibot'
import type { TakoParser } from '@kurotako/config'
import type { ParseContext } from '@kurotako/core'
import type { SourceIR } from '@kurotako/ir'

export const PrismaParserOptions = v.object({
  // path to a schema.prisma file OR a schema folder (prismaSchemaFolder) OR,
  // in the deferred v8 mode, a contract.json file. Resolved against ctx.cwd.
  schema: v.optional(v.string(), './prisma/schema.prisma'),
  // force the version mode; omitted => auto-detected from the input (see detect.ts)
  version: v.optional(v.picklist([7, 8])),
})
export type PrismaParserOptions = v.InferOutput<typeof PrismaParserOptions>

export const prismaParser: TakoParser<PrismaParserOptions> = {
  name: 'prisma',
  optionsSchema: PrismaParserOptions,
  async parse(ctx: ParseContext, options: PrismaParserOptions): Promise<SourceIR> {
    const input = await resolveInput(ctx.cwd, options)          // detect.ts
    const model =
      input.mode === 7
        ? await readDmmf(input, ctx.logger)                     // dmmf/
        : readContract(input, ctx.logger)                       // contract/ (deferred)
    return buildSourceIR(ctx.namespace, model)                  // map/build.ts
  },
  async watchPaths(ctx: ParseContext, options: PrismaParserOptions): Promise<string[]> {
    const input = await resolveInput(ctx.cwd, options)          // detect.ts
    return input.mode === 7
      ? input.files.map(([path]) => path)                       // the .prisma file, or every *.prisma in a schema folder
      : [input.contractPath]                                    // deferred v8 mode
  },
}
```

- `name: 'prisma'` — the short name / config key ([ADR-0006](../../../docs/adr/0006-parser-generator-vocabulary.md)).
  One package, **one** short name; the version mode is internal.
- Multiple instantiation ([ADR-0003](../../../docs/adr/0003-multiple-parsers-namespaces.md))
  needs nothing special: `prismaParser` is a stateless object, `parse` is called once per
  namespace with a different `ctx.namespace` and `options.schema`.
- `parserVersion` on the builder is set to `` `prisma@${detectedPrismaVersion}` `` (mode 7:
  read from the resolved `@prisma/internals` `package.json`; mode 8: the `contract.json`
  generator version) — traceability / cache key only, per
  [ir-model/technical.md §SourceIR](../ir-model/technical.md#schemas-and-type-surface-schemasts--typests).

### Version-mode detection (`detect.ts`)

```ts
type ResolvedInput =
  | { mode: 7; kind: 'file' | 'folder'; files: Array<[string, string]> } // [path, content] tuples
  | { mode: 8; kind: 'contract'; contractPath: string }

export async function resolveInput(cwd: string, o: PrismaParserOptions): Promise<ResolvedInput>
```

1. Resolve `o.schema` against `cwd`. `stat` it.
2. If `o.version` is set, it wins; otherwise infer:
   - a `*.prisma` file → `mode 7`, `kind: 'file'`;
   - a directory → `mode 7`, `kind: 'folder'`: collect every `*.prisma` under it
     (non-recursive first, then one level — matches Prisma's `prismaSchemaFolder` layout);
   - a `contract.json` file, or a directory containing one → `mode 8`.
3. `mode 7` reads each file's content into `[relativePath, content]` tuples (the multi-file
   datamodel shape `@prisma/internals` accepts). Missing path / empty folder / no `.prisma`
   → a `PrismaInputError` naming the resolved path and the namespace.

## Prisma ≤ 7 mode — DMMF acquisition (`dmmf/load.ts`)

```ts
// CJS-only package — named ESM import does NOT work under Node ESM (see spike #59).
// Resolve dynamically from the consumer's cwd instead:
//   const { getDMMF } = await import(require.resolve('@prisma/internals', { paths: [ctx.cwd] }))
export async function readDmmf(input: Extract<ResolvedInput, { mode: 7 }>, logger: Logger): Promise<PrismaModel>
```

- **`getDMMF`** is the documented programmatic entry
  (`@prisma/internals`, `getDMMF(options): Promise<DMMF.Document>`). It parses the schema via
  the bundled `prisma-schema-wasm` module — **no query-engine binary and no network at parse
  time** (the WASM call itself). Confirmed by [spike #59](../../tasks/59-prisma-getdmmf-spike.md)
  against `@prisma/internals` 5.22 / 6.19 / 7.10 (and `8.1.0-dev`).
- **Call shape** (`GetDMMFOptions`, stable across v5–v7): `{ datamodel: SchemaFileInput }`
  where `SchemaFileInput = string | Array<[filename, content]>`. Single-file:
  `getDMMF({ datamodel: content })`. Folder: `getDMMF({ datamodel: [[relPath, content], …] })`
  — the tuple array, file order irrelevant. `datamodelPath` was removed after v5;
  `previewFeatures` after v6; **`datasourceOverrides` is not accepted at all in v7** — pass
  neither, kurotako only needs the datamodel.
- **Error shape**: a schema error throws a `GetDmmfError extends Error` (v7) /
  `GetDmmfError` (v5–v6). `err.name === 'GetDmmfError'`, no structured fields — the P1012
  text (`Error code`, `error:` line, source excerpt, `[Context: getDmmf]`) is in
  `err.message`. Wrap as `PrismaSchemaError` keeping `err.message` and `cause`, plus the
  namespace; core then surfaces it as a `DriverError`
  ([core-pipeline/technical.md §Error model](../core-pipeline/technical.md#error-model-errorts)).
- If `@prisma/internals` cannot be resolved (peer not installed) → a `PrismaPeerMissingError`
  with the install hint `add @prisma/internals@<major> as a devDependency` (major matched to
  the resolved `@prisma/client`), before any parsing.
- **Caveat**: installing `@prisma/internals` pulls `@prisma/engines`, whose `postinstall`
  downloads a ~24 MB `schema-engine` binary. `getDMMF` does not use it, but the install-time
  cost is real. Not kurotako's to fix — noted so the peer-missing hint can mention it.

### Spike #59 findings (`getDMMF`)

- **`getDMMF` is alive and WASM-based** in `@prisma/internals` 5 → 7, and still exported in
  `8.1.0-dev` (Prisma 8 had not, at spike time, dropped the DSL/DMMF path — but 8 is
  unreleased, hence the conservative `<8` upper bound; the contract mode stays the plan for
  8, [see below](#prisma-8-mode--deferred-past-kurotako-v1)).
- **Prisma 7 restructured the CLI.** `prisma` + `@prisma/client` v7 no longer pull
  `@prisma/internals` (the CLI is built on `@prisma/orm-framework` / `@prisma/orm-toolchain`
  with a contract + PSL-parser model, and `@prisma/prisma-schema-wasm` is not in the tree).
  On a v7 project the peer resolves **only if the user adds `@prisma/internals` explicitly**.
  Decision (confirmed with the maintainer): keep the peer, make `PrismaPeerMissingError` +
  install hint the nominal v7 path. Prisma 5–6 are unaffected (their `prisma` CLI still
  provides `@prisma/internals` transitively).
- **`@prisma/client`-only projects** (no `prisma` devDep) never resolve `@prisma/internals`
  on any major → same `PrismaPeerMissingError` path.
- **DMMF shape verified** (drives [#28](../../tasks/28-prisma-dmmf-reader.md)): `DMMF.Model`
  exposes `name`, `dbName`, `primaryKey {name, fields}`, `uniqueIndexes [{name, fields}]`,
  `uniqueFields`, `documentation` — **no `indexes` key at all** (non-unique `@@index` is not
  in the DMMF; the [Accepted limitation](#accepted-limitations-v1-dmmf-mode) is now
  confirmed, not conditional). `DMMF.Field`: `kind`, `isList`, `isRequired`, `isUnique`,
  `isId`, `isUpdatedAt`, `hasDefaultValue`, `type`, `nativeType: [name, string[]] | null`
  (e.g. `["VarChar", ["120"]]`, `["Uuid", []]`), `default` (literal, or `{ name, args }`
  e.g. `{ name: 'uuid', args: [4] }`, `{ name: 'now', args: [] }`), relation fields.
- **`Unsupported("…")` fields**: in the v7 spike an optional `Unsupported(...)` field was
  **absent** from `doc.datamodel` entirely (no `kind: 'unsupported'` entry). [#29](../../tasks/29-prisma-scalar-mapping.md)
  must not assume the field is present; re-verify the exact condition there.
- Scratch script lives outside the repo (spike only); nothing committed to any package.

`dmmf/read.ts` flattens `DMMF.Document.datamodel` (`models`, `enums`, `types`) into a small
**mode-neutral `PrismaModel`** shape (plain records: entities, fields, enums, raw relation
edges). `map/build.ts` consumes only `PrismaModel`, so the v8 contract reader can produce
the same shape later without touching the mapping logic.

## DMMF → `SourceIR` mapping (`map/`)

Everything below is expressed through the `createSourceIR` builder. Entity/field/enum names
are used verbatim (deterministic identifiers, never namespaced —
[ADR-0004](../../../docs/adr/0004-ir-namespace-first.md)).

### Scalars (`map/scalars.ts`)

| Prisma field `type` | IR `ScalarType` |
|---|---|
| `String` | `string` |
| `Boolean` | `boolean` |
| `Int` | `int` |
| `BigInt` | `bigint` |
| `Float` | `float` |
| `Decimal` | `decimal` |
| `DateTime` | `datetime` |
| `Json` | `json` |
| `Bytes` | `bytes` |
| `Unsupported("…")` (`kind: 'unsupported'`) | `FieldType { kind: 'unknown', hint: '<the raw type>' }` |
| field `kind: 'enum'` | `FieldType { kind: 'enum', ref: <type> }` |

`decimal` / `bigint` / `json` / `bytes` stay **named scalars only** — runtime
representation is each generator's call
([ir-model/technical.md](../ir-model/technical.md#notes-on-modelling-choices)).

### Native `@db.*` types → scalar refinement + constraints

`DMMF.Field.nativeType` is a `[name, args] | null` tuple. **Decided (Q: "string +
`constraints.format`")**: keep the base scalar, express semantics through `format`; the
`uuid` scalar is reserved for columns that are genuinely UUID-typed in the database.

| Native type | Effect |
|---|---|
| `@db.VarChar(n)` / `@db.Char(n)` / `@db.NVarChar(n)` / `String(n)` | `constraints.maxLength = n` |
| `@db.Uuid`, `@db.ObjectId` | scalar → `uuid` |
| `@db.Date` (on `DateTime`) | scalar → `date` |
| `@db.Time` / `@db.Timetz` (on `DateTime`) | scalar stays `datetime`, `constraints.format = 'time'` |
| `@db.Text` / `@db.Citext` / `@db.Xml` … | no change (base `string`) |
| numeric native types (`@db.SmallInt`, `@db.Money`, …) | no change in v1 (range refinement deferred) |

Unknown / unmapped native types are ignored (logged at `debug`), never fatal.

### String `format` from generator defaults

`String` fields with `@default(uuid())` / `@default(cuid())` / `@default(cuid(2))` /
`@default(ulid())` set `constraints.format` to `uuid` / `cuid` / `cuid2` / `ulid`
respectively **without** changing the scalar (it stays `string`). `@default(nanoid())` has
no matching `format` in the closed
[`StringFormat`](../ir-model/technical.md#schemas-and-type-surface-schemasts--typests) list
→ no `format` (a `regex` fallback is deferred). The value-generation itself is still
recorded as a `default` (next section).

### Defaults (`map/defaults.ts`)

`DMMF.Field.default` is a literal, a `{ name, args }` function call, or (for enums) a
string. Mapped to
[`DefaultValue`](../ir-model/technical.md#schemas-and-type-surface-schemasts--typests):

| Prisma default | IR `DefaultValue` |
|---|---|
| literal (`"x"`, `42`, `true`, `["a","b"]`) | `{ kind: 'value', value }` |
| enum value | `{ kind: 'value', value: '<NAME>' }` |
| `now()` | `{ kind: 'expr', expr: 'now()' }` |
| `autoincrement()` | `{ kind: 'expr', expr: 'autoincrement()' }` |
| `dbgenerated("…")` | `{ kind: 'expr', expr: 'dbgenerated', args: ['…'] }` |
| `uuid()` / `cuid()` / `cuid(2)` / `ulid()` / `nanoid()` | `{ kind: 'expr', expr: '<fn>()' }` (+ the `format` above) |

### Cardinality, `optional`, `nullable`

- `list` ← `DMMF.Field.isList`.
- `nullable` ← `!isRequired` (Prisma `?`), per
  [ir-model/technical.md §Notes](../ir-model/technical.md#notes-on-modelling-choices).
- `optional` (**Decided** — "true if DB default or `@updatedAt` or
  `@default(autoincrement())`"): `optional = hasDefaultValue || isUpdatedAt`. `nullable`
  alone does **not** imply `optional`. This gives generators a usable "may be omitted on
  create" signal from v1; they still refine create/update variants themselves.

### Constraints, keys, indexes

| Prisma | IR |
|---|---|
| single-field `@id` | field added to `Entity.primaryKey` |
| `@@id([a, b])` (`model.primaryKey.fields`) | `Entity.primaryKey = [a, b]` |
| single-field `@unique` (`Field.isUnique`) | `constraints.unique = true` |
| `@@unique([a, b])` (`model.uniqueIndexes` / `uniqueFields`) | `Entity.uniques.push({ fields, name? })` |
| non-unique `@@index([…])` | `Entity.indexes.push({ fields, name?, type? })` **iff** the pinned `@prisma/internals` DMMF exposes model indexes; otherwise a **documented gap** (see Accepted limitations) |
| `///` doc comment (`documentation`) | `doc` on entity / field / enum / enum value, **verbatim, uninterpreted** |
| `@@map` (`model.dbName`) | `Entity.dbName` |
| `@map` on an enum value (`DMMF.EnumValue.dbName`) | `EnumValue.dbName` |
| `@@map` on an enum | `EnumDef.dbName` |
| `@map` on a **field** | **not available** — DMMF does not expose field-level `@map`; dropped in v1 (see Accepted limitations) |

Enums are emitted at **source level** (`SourceIR.enums`) — matches Prisma, where every
`enum` is top-level. Entity-local enums are never produced by this parser.

### Relations (`map/relations.ts`)

DMMF relation fields have `kind: 'object'`. The two sides share a `relationName`. Pairing:

- group object fields by `relationName`; each group has one or two sides.
- **owning side**: `relationFromFields.length > 0`. `fkFields = relationFromFields`
  (scalar field names on this entity), `references = relationToFields` (field names on the
  target).
- `cardinality`: `isList ? 'many' : 'one'`.
- `optional`: `!isRequired` (a nullable to-one / possibly-empty association).
- `owning`: true on the side carrying `relationFromFields`.
- `backRelation`: the `name` of the other object field in the same `relationName` group
  (when present).
- `onDelete` / `onUpdate`: `relationOnDelete` / `relationOnUpdate` mapped
  `Cascade→cascade`, `Restrict→restrict`, `SetNull→setNull`, `SetDefault→setDefault`,
  `NoAction→noAction`.
- `target`: `{ namespace: ctx.namespace, entity: <related model> }` — always same-namespace
  for a single Prisma schema. (Cross-source targets are an IR-level capability only,
  [ADR-0003](../../../docs/adr/0003-multiple-parsers-namespaces.md).)

The backing scalar column (e.g. `authorId`) stays an ordinary `Field`; it is referenced by
`relation.fkFields`, not removed — consistent with
[ir-model/technical.md §Notes](../ir-model/technical.md#notes-on-modelling-choices).

### Implicit many-to-many — materialised (`map/relations.ts`)

An implicit Prisma m2m has, on **both** sides, `kind: 'object'`, `isList: true`,
`relationFromFields` **and** `relationToFields` empty. **Decided** (overview + Q: "readable
name, `<model>Id` fields"): the hidden join table is materialised as a real IR entity so
generators see a uniform, explicit-m2m model.

For a pair `(A, B)` with relation name `R`:

- **Synthetic entity name**: the `@relation("…")` name when the user set one and it is not
  Prisma's default `"AToB"` form; otherwise `` `${x}${y}` `` where `[x, y]` are the two
  model names sorted lexicographically (deterministic regardless of which side is parsed
  first).
- **Fields**: `` `${lcfirst(x)}Id` `` and `` `${lcfirst(y)}Id` ``, each a `scalar` matching
  the referenced entity's primary-key scalar (fallback `string` if the PK is composite or
  unresolved — logged at `debug`).
- **`primaryKey`**: both FK fields (composite).
- **Relations**: two `one` relations from the synthetic entity to `A` and to `B`, each
  `owning: true`, `fkFields` set, `references` = the target PK, `onDelete: 'cascade'`
  (Prisma's implicit-join behaviour).
- **The two original list relations** are rewritten to target the synthetic entity
  (`cardinality: 'many'`, `owning: false`, `backRelation` → the matching synthetic-side
  relation).

Trade-off recorded: this adds an entity absent from the source schema, and a generator that
wanted a native m2m must recombine it. The overview chose uniformity with explicit m2m over
a bespoke m2m shape. Prisma 8's stance on implicit m2m is an open question for that mode.

## Prisma 8 mode — deferred past kurotako v1

Prisma moves from the DSL/DMMF model to a deterministic emitted **contract**
(`contract.json` — canonical JSON of models, storage and capabilities — plus
`contract.d.ts`). [Spike #59](#spike-59-findings-getdmmf) found this transition already
underway in the **Prisma 7** CLI (`@prisma/orm-framework` `./contract` + `./psl-parser`),
while `getDMMF` via a standalone `@prisma/internals` still works for 5–7. v1 targets the
DMMF path for `<8`; the contract reader is the plan for 8. Plan, not built in v1:

- `contract/read.ts` reads an already-emitted `contract.json` (the user runs
  `prisma contract emit` in their build) and produces the same mode-neutral `PrismaModel`
  shape → `map/build.ts` is reused unchanged.
- **Zero `@prisma/*` dependency** in this mode: it is plain JSON parsing + a Valibot schema
  for `contract.json`'s structure.
- Open, to be closed when this mode is picked up (kept out of v1 scope so nothing here
  hard-codes against them):
  - the exact `contract.json` type vocabulary → `ScalarType` / `format` mapping;
  - whether Prisma 8 still emits implicit m2m or always materialises the join model;
  - `contract.json` schema versioning and how the parser pins/validates it;
  - whether `contract.d.ts` is ever needed (probably not — `contract.json` is canonical).

The v1 work must keep `PrismaModel` free of DMMF-only assumptions so this stays a
front-end swap.

## Alternatives considered

- **Home-grown PSL parser** instead of `getDMMF`. Rejected in
  [overview.md](overview.md#decisions-made): reimplements enum/relation/native-type
  resolution and must chase Prisma syntax changes. `getDMMF` is WASM-based (no engine
  binary), which removes the historical objection (heavy engine download).
- **`@prisma/internals` as a direct pinned `dependency`.** Rejected (Q answered):
  the parse would use a Prisma version that can differ from the user's schema semantics,
  and it double-installs a multi-MB package. Peer dependency keeps the DMMF aligned with
  the project's own Prisma.
- **Run as a `prisma generate` generator** (receiving DMMF on stdin, like
  `zod-prisma-types`). Rejected: kurotako is standalone and source-agnostic
  ([docs/vision.md](../../../docs/vision.md)); it must not require a Prisma generator block
  or a `prisma generate` run.
- **Not materialising implicit m2m** (relation `many`↔`many`, no join entity). Rejected in
  the discussion: generators would each special-case it; a materialised join entity is the
  uniform model.
- **Prisma-native join-table name `_AToB` with `A` / `B` columns.** Rejected (Q answered):
  the physical name and single-letter columns are hostile to generated code; a readable
  `${A}${B}` entity with `<model>Id` FKs reads like a hand-written explicit m2m.
- **Two packages (`@kurotako/parser-prisma` + `@kurotako/parser-prisma8`).** Rejected in
  [overview.md](overview.md): one package, internal version mode, one `prisma` config key.

## Accepted limitations (v1, DMMF mode)

- **Field-level `@map` is lost.** DMMF exposes model/enum `dbName` but not `Field.dbName`.
  `Field.dbName` stays undefined in v1. Revisit with a light PSL scan if a generator needs
  it.
- **Non-unique `@@index` is lost.** Confirmed by [spike #59](#spike-59-findings-getdmmf):
  `DMMF.Model` has no `indexes` key in `@prisma/internals` 5–7, only `uniqueIndexes` /
  `uniqueFields`. `Entity.indexes` stays `[]` in DMMF mode. No v1 generator consumes
  indexes, so this is latent. Revisit with a light PSL scan if needed.
- **`nanoid()` / exotic string generators** produce a `default` expr but no `format`.
- **Composite-type fields** (`type` blocks, MongoDB) map to `FieldType { kind: 'unknown' }`
  in v1 — full composite-type support is out of scope.

## Consequences verified against the repo / other features

- Nothing to migrate: `packages/parser-prisma/src/index.ts` is the bootstrap placeholder
  ([task #6](../../tasks/6-package-skeletons.md)). This feature rewrites it.
- **[monorepo-bootstrap #6](../../tasks/6-package-skeletons.md)** — the parser-prisma
  skeleton needs `tsconfig` `references` to `../ir`, `../core`, `../config` and the peer
  `@prisma/internals`. #6 step 2 already says "references to the imported internal
  packages"; the explicit list + the peer entry are a small addition to that task (doc-only
  until #6 is implemented).
- **[ir-model/technical.md](../ir-model/technical.md)** — the parser is the first real
  consumer of `createSourceIR`. It exercises: `optional` vs `nullable` split, source-level
  enums with `@map`, `primaryKey` (single + composite), `DefaultValue` both `kind`s,
  `Relation.fkFields` / `references` / `backRelation`, `FieldType.unknown`. No IR change
  required; the `StringFormat` list already covers `uuid` / `cuid` / `cuid2` / `ulid`.
- **[config-system/technical.md](../config-system/technical.md)** — `prismaParser` matches
  the fixed `TakoParser<O>` shape (object, `optionsSchema`, `parse(ctx, options)`, and the
  optional `watchPaths(ctx, options)` added by [cli](../cli/technical.md#the-watchpaths-contract-addition)).
  `@kurotako/config` validates `PrismaParserOptions` and curries `options` away; core sees a
  plain `Parser`. `valibot` is already a dep of drivers that declare options.
- **[core-pipeline/technical.md](../core-pipeline/technical.md)** — `parse` returns a
  `SourceIR`; core runs `validateSourceIR` and wraps a throw as `DriverError`. The parser
  adds `PrismaInputError` / `PrismaPeerMissingError` / `PrismaSchemaError` (its own classes,
  surfaced through `DriverError`).
- **[generator-zod/overview.md](../generator-zod/overview.md) /
  [generator-angular/overview.md](../generator-angular/overview.md)** — their open questions
  on `Decimal` / `bigint` / `Json` / date rendering and `format` → refinement are answered
  on the IR side (named scalars + `format` vocabulary); this parser guarantees those fields
  are populated. Relation rendering (nested vs id) is unaffected: the parser always provides
  `fkFields` + `references` + `cardinality`.
- **docs/architecture.md / docs/vision.md** — `docs/vision.md` open question §2 (non-trivial
  Prisma types) and §4 (relations depth) are now concretely answered for the Prisma side;
  reconcile the prose when this lands (doc-only, not this phase).

## Tests (vitest, colocated)

Fixture-driven: a set of `schema.prisma` strings fed through `getDMMF` → `buildSourceIR`,
asserting the resulting `SourceIR` (structure, not a code snapshot).

- **scalars**: every Prisma scalar → expected `ScalarType`; `Unsupported(...)` → `unknown`
  with hint.
- **native types**: `@db.VarChar(120)` → `maxLength`; `@db.Uuid` → scalar `uuid`;
  `@db.Date` → scalar `date`; unknown native type ignored.
- **string format**: `@default(uuid())` / `@default(cuid())` → `format`, scalar stays
  `string`, `default` expr recorded; `@default(nanoid())` → expr, no `format`.
- **optional / nullable**: `String?` → `nullable`, not `optional`; `createdAt DateTime
  @default(now())` → `optional`; `@updatedAt` → `optional`.
- **keys**: single `@id` → `primaryKey`; `@@id([a,b])` → composite; `@unique` →
  `constraints.unique`; `@@unique([a,b])` → `Entity.uniques`.
- **relations**: 1-1, 1-n (owning side has `fkFields`/`references`, other side has
  `backRelation`), `onDelete: Cascade` → `cascade`, optional to-one.
- **explicit m2m** (join model present) → two 1-n relations, join entity untouched.
- **implicit m2m** → synthetic entity: name = sorted `${A}${B}` (and `@relation("Foo")` →
  `Foo`), `<model>Id` FK fields, composite PK, two owning `one` relations, originals
  rewritten to `many` at the synthetic entity.
- **metadata**: `///` doc on model/field/enum/value carried verbatim; `@@map` → `dbName`;
  field `@map` absent from the result (documented gap).
- **multi-file**: a `prisma/` folder with `schema.prisma` + `user.prisma` merges into one
  `SourceIR`.
- **errors**: missing schema path → `PrismaInputError`; invalid schema → `PrismaSchemaError`
  carrying the Prisma message; `@prisma/internals` unresolved → `PrismaPeerMissingError`
  (simulated).
- **determinism**: parsing the same schema twice yields a deep-equal `SourceIR`; entity /
  field / enum key order is stable.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#26 prisma-parser-scaffold](../../tasks/26-prisma-parser-scaffold.md) — `package.json`
   deps (`@prisma/internals` peer), `tsconfig` refs, `src/options.ts`
   (`PrismaParserOptions`), `src/errors.ts`, `src/parser.ts` skeleton, barrel
   (deps: #6, #11, #14, #15, #22).
2. [#27 prisma-input-detection](../../tasks/27-prisma-input-detection.md) — `src/detect.ts`
   `resolveInput()`: schema file / folder / `contract.json`, version-mode inference,
   multi-file tuples (dep: #26).
3. [#28 prisma-dmmf-reader](../../tasks/28-prisma-dmmf-reader.md) — `src/dmmf/` neutral
   `PrismaModel` shape, `getDMMF` wrapper (peer resolution, error wrapping),
   `DMMF.Document → PrismaModel` (deps: #26, #27).
4. [#29 prisma-scalar-mapping](../../tasks/29-prisma-scalar-mapping.md) —
   `src/map/scalars.ts` + `src/map/defaults.ts`: scalar table, `@db.*` refinement,
   `format` from generator defaults, `DefaultValue` mapping (dep: #28).
5. [#30 prisma-relation-mapping](../../tasks/30-prisma-relation-mapping.md) —
   `src/map/relations.ts`: relation pairing, owning side, referential actions, implicit
   m2m materialisation (deps: #28, #29).
6. [#31 prisma-sourceir-build](../../tasks/31-prisma-sourceir-build.md) —
   `src/map/build.ts` `buildSourceIR()` via `createSourceIR`, final `parser.ts` wiring,
   end-to-end fixture tests (deps: #29, #30).
