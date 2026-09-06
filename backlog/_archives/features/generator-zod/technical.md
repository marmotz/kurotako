# Zod generator (`@kurotako/gen-zod`) — technical design

Design for `@kurotako/gen-zod`. Product decisions come from [overview.md](overview.md); the
generator role and the DAG/artifact model live in
[docs/architecture.md](../../../../docs/architecture.md). This document turns the overview
into a concrete package, an IR → Zod source-text mapping, and the artifact shape the
overview deferred here.

> **Amendment ([output-modes/technical.md](../output-modes/technical.md))**: this
> generator's `VirtualFile.path` prefix is **`<ns>/zod/`**, not `<ns>/` (one sub-tree per
> generator; core synthesizes `<ns>/index.ts`). Every module specifier below gains the
> `zod/` segment (`<ns>/zod/<entity>.schema`, `<ns>/zod/enums`, `<ns>/zod/filters`,
> `<ns>/zod`). The artifact gains `peerDependencies: { zod: <range from zodVersion> }`
> (`zodVersion: 4` → `'^4'`, `3` → `'^3'`). Sibling generators read these values from the
> artifact, so no consumer code changes — only the emitted paths and the artifact values.
> Occurrences below are written in the pre-amendment form; apply the `zod/` segment
> uniformly.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) scaffolds
  `packages/gen-zod/` with a single `src/index.ts` exporting a `version` const and one
  trivial test. This feature replaces that placeholder with the real generator.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API.** The generator produces **strings only** — it never touches the disk
  (core's `Writer` owns I/O, [core-pipeline/technical.md §Writer seam](../core-pipeline/technical.md#writer-seam)).
- Upstream contracts already designed:
  - [`@kurotako/ir`](../ir-model/technical.md) — the `IR` / `Entity` / `Field` / `FieldType`
    / `ScalarType` / `StringFormat` / `Constraints` / `DefaultValue` / `Relation` / `EnumDef`
    types and the pure traversal helpers (`iterEntities`, `iterFields`, `resolveEnum`,
    `resolveRelationTarget`, `isCrossSource`, `primaryKeyFields`)
    ([ir-model/technical.md §Helpers](../ir-model/technical.md#helpers-helpersts)). The
    generator reads the IR **only** through these types/helpers.
  - [`@kurotako/core`](../core-pipeline/technical.md) — declares `Generator`,
    `GenerateContext` (`{ ir, dependencies, logger }`, the `ir` already namespace-filtered),
    `GenOutput` (`{ files: VirtualFile[]; artifact: GeneratorArtifact }`), and the fixed
    `GeneratorArtifact` / `EntitySymbols` interop shape
    ([core-pipeline/technical.md §Artifact manifest](../core-pipeline/technical.md#artifact-manifest-generatorartifact)).
    A generator owns the `<namespace>/` prefix on every `VirtualFile.path`.
  - [`@kurotako/config`](../config-system/technical.md) — the driver-facing shape is
    `TakoGenerator<O>`: an **object** with `name`, an optional Valibot `optionsSchema`, and
    `generate(ctx, options)`. `@kurotako/config` validates `options` and **curries it away**
    before core sees a plain `Generator`
    ([config-system/technical.md §Config shape](../config-system/technical.md#config-shape-and-defineconfig-typests-definets)).
- Downstream: [generator-angular](../generator-angular/technical.md) is a **hard**
  consumer (`dependsOn: ['zod']`) — it always reads this generator's artifact
  (`Create` / `Update` / `*Deep*` roles + `ZodArtifactExtra.perNamespace[ns].enums`). The
  artifact shape is therefore a required contract, not a nice-to-have.
- Relevant design decisions (see [docs/architecture.md](../../../../docs/architecture.md)
  and [docs/glossary.md](../../../../docs/glossary.md)): full generator, not a middle stage
  (the DAG / hard-vs-optional dependency model); deterministic identifiers, never
  namespace-prefixed; namespace drives output location only; single entry point,
  mode-B friendly; `generator` role, package `@kurotako/gen-<x>`, one short name.

## Package shape

Single entry point (keeps the `exports` map identical to the bootstrap skeleton and to what
mode B emits — [docs/architecture.md](../../../../docs/architecture.md)).

```
packages/gen-zod/src/
  index.ts              # barrel: zodGenerator + public types (ZodGeneratorOptions, ZodArtifactExtra)
  generator.ts          # zodGenerator: TakoGenerator<ZodGeneratorOptions> — orchestrates generate()
  options.ts            # Valibot ZodGeneratorOptions schema + defaults
  errors.ts             # ZodGenError hierarchy
  names.ts              # deterministic identifier + module-specifier helpers
  dialect.ts            # the v3-vs-v4 API differences behind one interface
  render/
    scalars.ts          # ScalarType -> base Zod expression (dialect-aware)
    constraints.ts      # Constraints -> chained refinements (dialect-aware)
    field.ts            # Field -> full Zod expression (scalar/enum/unknown + list + null/opt + default)
    variants.ts         # per-entity field-set derivation for full / create / update / where / select
    relations.ts        # flat (FK id) vs deep (z.lazy nested) relation rendering
  emit/
    entity.ts           # one entity -> "<ns>/zod/<entity>.schema.ts" source text
    enums.ts            # all enums of a source -> "<ns>/zod/enums.ts" source text
    filters.ts          # shared Where operator schemas -> "<ns>/zod/filters.ts" source text
    barrel.ts           # "<ns>/zod/index.ts" re-export barrel (this generator's own sub-tree)
  artifact.ts           # assemble GeneratorArtifact (entities + ZodArtifactExtra)
  *.test.ts
```

### Dependencies

| Dep | Kind | Why |
|---|---|---|
| `@kurotako/ir` | `dependencies` (`workspace:*`) | IR **types** + traversal **helpers**, used at runtime while rendering |
| `@kurotako/core` | `peerDependencies` + `devDependencies` (`workspace:*`) | `Generator` / `GenerateContext` / `GenOutput` / `GeneratorArtifact` **types** only |
| `@kurotako/config` | `peerDependencies` + `devDependencies` (`workspace:*`) | `TakoGenerator` **type** only |
| `valibot` | `dependencies` | `optionsSchema` |

- **No `zod` dependency.** The generated code imports `zod`; the generator only emits its
  source text. The consuming project already has `zod` installed (that is what it wants
  schemas for).
- `tsconfig.json` `references`: `[{ "path": "../ir" }, { "path": "../core" }, { "path": "../config" }]`
  — a small pin for [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) step 2
  (doc-only until #6 is implemented).
- `"sideEffects": false`.

## Public contract (`generator.ts` + `options.ts`)

```ts
import * as v from 'valibot'
import type { TakoGenerator } from '@kurotako/config'
import type { GenerateContext, GenOutput } from '@kurotako/core'

export const ZodGeneratorOptions = v.object({
  // one emit targets one Zod API flavor (decided): explicit, no environment probing
  zodVersion: v.optional(v.picklist([3, 4]), 4),
})
export type ZodGeneratorOptions = v.InferOutput<typeof ZodGeneratorOptions>

export const zodGenerator: TakoGenerator<ZodGeneratorOptions> = {
  name: 'zod',
  optionsSchema: ZodGeneratorOptions,
  generate(ctx: GenerateContext, options: ZodGeneratorOptions): GenOutput {
    // pure, synchronous: iterate ctx.ir.sources, render text, assemble the artifact
  },
}
```

- `name: 'zod'` — the short name / config key
  ([docs/glossary.md](../../../../docs/glossary.md)). One package, one
  short name.
- `dependsOn` / `optionalDependsOn` are **absent** — the Zod generator reads nothing but
  the IR.
- `generate` is **synchronous and pure**: same IR + same options → deep-equal `GenOutput`
  (required by [drift-guard](../drift-guard/overview.md)).
- **Options kept minimal for v1** (decided): only `zodVersion`. Export names are fixed by
  [docs/architecture.md](../../../../docs/architecture.md) / the overview and are **not**
  configurable; the scalar-rendering defaults (overview "pragmatic defaults") are **not**
  configurable in v1 — an override map is a later evolution.

## Naming (`names.ts`) — deterministic, never namespace-prefixed

Entity `User`, per [docs/architecture.md](../../../../docs/architecture.md) and the
overview (`UserSchema` + `UserDto` locked):

| Variant | flat family schema / type | deep family schema / type |
|---|---|---|
| full | `UserSchema` / `UserDto` | `UserDeepSchema` / `UserDeepDto` |
| create | `UserCreateSchema` / `UserCreateDto` | `UserCreateDeepSchema` / `UserCreateDeepDto` |
| update | `UserUpdateSchema` / `UserUpdateDto` | `UserUpdateDeepSchema` / `UserUpdateDeepDto` |
| where | `UserWhereSchema` / `UserWhereDto` | `UserWhereDeepSchema` / `UserWhereDeepDto` |
| select | `UserSelectSchema` / `UserSelectDto` | `UserSelectDeepSchema` / `UserSelectDeepDto` |

- Pattern: `${Entity}${Variant}${Family}Schema` with `Variant ∈ {'', 'Create', 'Update',
  'Where', 'Select'}` and `Family ∈ {'', 'Deep'}`. `Dto` type = same stem, `Dto` instead of
  `Schema`, declared `export type UserDto = z.infer<typeof UserSchema>`.
- Enums: `EnumDef` named `Role` → `export const Role = [...] as const`,
  `export const RoleSchema = z.enum(Role)`, `export type Role = (typeof Role)[number]`
  (const value and type share the name — legal, distinct TS namespaces). The IR already
  resolves enum refs (entity-local before source-level,
  [ir-model/technical.md](../ir-model/technical.md#runtime-validation-validatets)); emission
  uses the resolved `EnumDef` name verbatim.
- Two **distinct** `EnumDef`s reachable in one source under the same name (an entity-local
  enum shadowing a differently-defined source-level one) → `ZodEnumCollisionError` naming
  both. Same-name identical defs are de-duplicated.
- **Module specifiers** (for cross-file `import`): `<ns>/<entity>.schema`, `<ns>/enums`,
  `<ns>/filters`, `<ns>` (barrel). Extension-less, POSIX. Emitted verbatim into generated
  `import` statements and reported in the artifact; how the consumer resolves them is the
  core `EntitySymbols.module` contract, not this feature.

## File layout (decided: one file per entity + shared enums file)

Under the output root, per namespace `<ns>` (namespace drives location only —
[docs/architecture.md](../../../../docs/architecture.md)):

```
generated/<ns>/
  enums.ts          # every source-level + entity-local EnumDef of this source (const array + z.enum + type)
  filters.ts        # shared Where operator schemas (StringFilter, IntFilter, DateTimeFilter, BoolFilter, Enum<Name>Filter)
  <entity>.schema.ts  # one per entity: all 5 variants x 2 families + z.infer types; imports from ./enums, ./filters, sibling ./<other>.schema
  index.ts          # barrel: export * from every file above
```

- `enums.ts` and `filters.ts` are **refinements of the overview** (which mentioned only
  `<ns>/user.schema.ts` + `index.ts`): the operator objects in the `Where` variant need
  shared primitives, and enums are shared across entity files. `filters.ts` is emitted
  whenever the source has ≥ 1 entity (every entity gets a `Where` variant in the kept-full
  matrix); `enums.ts` is emitted always (possibly empty barrel line).
- A source with **zero entities** still emits `enums.ts` (if it has enums) and an
  `index.ts`.
- One file per entity (not per variant) keeps the import graph flat; `z.lazy` handles the
  cycles the deep family introduces between sibling entity files.

## IR → Zod source-text mapping

Everything is text assembly. Entities and fields are iterated in `@kurotako/ir` key order
(`iterEntities` / `iterFields`) for determinism; enums are emitted sorted by name.

### Base scalar expression (`render/scalars.ts`, dialect-aware)

`FieldType.kind === 'scalar'` (overview "pragmatic defaults"):

| `ScalarType` | Zod v4 | Zod v3 |
|---|---|---|
| `string` | `z.string()` | `z.string()` |
| `boolean` | `z.boolean()` | `z.boolean()` |
| `int` | `z.int()` | `z.number().int()` |
| `bigint` | `z.bigint()` | `z.bigint()` |
| `float` | `z.number()` | `z.number()` |
| `decimal` | `z.string()` | `z.string()` |
| `date` | `z.coerce.date()` | `z.coerce.date()` |
| `datetime` | `z.coerce.date()` | `z.coerce.date()` |
| `uuid` | `z.uuid()` | `z.string().uuid()` |
| `bytes` | `z.string()` | `z.string()` |
| `json` | `z.unknown()` | `z.unknown()` |

- `FieldType.kind === 'enum'` → `<EnumName>Schema` (imported from `./enums`).
- `FieldType.kind === 'unknown'` → `z.unknown()` with a trailing `// unknown${hint ? ': ' + hint : ''}`
  comment (logged at `debug`).
- `decimal` as `z.string()` and `bigint` as `z.bigint()` are documented lossy/represented
  choices carried from [ir-model](../ir-model/technical.md#notes-on-modelling-choices); an
  override map is deferred.

### Constraints (`render/constraints.ts`, dialect-aware)

Applied as a chain on the base expression, in this fixed order:

| `Constraints` field | string base | numeric base |
|---|---|---|
| `format` (string only) | v4: replace base with the top-level builder (`z.email()`, `z.url()`, `z.uuid()`, `z.cuid()`, `z.cuid2()`, `z.ulid()`, `z.ipv4()`, `z.ipv6()`, `z.iso.datetime()`, `z.iso.date()`, `z.iso.time()`, `z.iso.duration()`); v3: method form (`.email()`, `.url()`, `.uuid()`, `.cuid()`, `.cuid2()`, `.ulid()`, `.ip({ version })`, `.datetime()`, …) | — |
| `minLength` / `maxLength` | `.min(n)` / `.max(n)` | — |
| `regex` | `.regex(new RegExp(<json-quoted source>))` | — |
| `min` / `max` | — | `.min(n)` / `.max(n)` |
| `unique` | **no schema effect** (DB-level, not a validation rule) — documented | same |

- The closed `StringFormat` union lets `render/constraints.ts` `switch` exhaustively; an
  unrecognised value is impossible (IR validation rejects it upstream).
- `format` + `regex` both present: `format` wins for the base, `regex` still appended.

### Field expression assembly (`render/field.ts`)

For a `Field` in a given variant:

1. base = scalar/enum/unknown expression (above) + constraint chain.
2. if `field.list` → `z.array(<base>)`.
3. if `field.nullable` → `.nullable()`.
4. optionality is **variant-driven** (next section), appended as `.optional()`.
5. literal default: in the **Create** variant only, `DefaultValue.kind === 'value'` →
   `.default(<json value>)`. `kind === 'expr'` (db-side: `now()`, `autoincrement()`,
   `uuid()`, `dbgenerated`) is **never** emitted as `.default()` — it only makes the field
   optional on Create (the DB/server assigns it).

### Variant field sets (`render/variants.ts`)

The `create` / `update` field selection and create-optionality come from
`@kurotako/ir`'s shared-decision helpers (`createFields`, `isCreateOptional`,
`updateFields`, `isDbAssigned` —
[ir-model/technical.md §Shared-decision helpers](../ir-model/technical.md#shared-decision-helpers-helpersts)),
**not** re-encoded here. `render/variants.ts` only maps the resulting field lists to Zod
expressions and layers on the Zod-specific projections (`where` filter wrapping, `select`).
`generator-angular` consumes the same helpers, so its control tree and this schema stay in
lockstep by construction.

| Variant | Fields included | Optionality rule |
|---|---|---|
| full | all scalar/enum fields | `field.optional` from the IR → `.optional()` |
| create | all except fields whose only source of value is db-side (`primaryKey` field with an `expr` default, `@updatedAt`-style `expr` default) | required unless `field.optional` **or** `field.default` present → `.optional()` (+ `.default()` for literal defaults) |
| update | full field set **minus `primaryKey` fields**, entire object `.partial()` | every field optional |
| where | all scalar/enum fields, each wrapped in its filter schema (below), all optional; plus `AND` / `OR` / `NOT` | every entry optional |
| select | all scalar/enum fields **and** relations, each `z.boolean().optional()` (flat) / `z.union([z.boolean(), z.lazy(() => <Target>SelectSchema)]).optional()` (deep) | every entry optional |

### Where operator schemas (decided: Prisma-style, `emit/filters.ts`)

Shared per namespace in `filters.ts`, one schema per scalar class actually used:

```ts
// shape (v4 shown; v3 swaps builders per the dialect table)
export const StringFilter = z.object({
  equals: z.string().optional(), not: z.string().optional(),
  in: z.array(z.string()).optional(), notIn: z.array(z.string()).optional(),
  lt: z.string().optional(), lte: z.string().optional(),
  gt: z.string().optional(), gte: z.string().optional(),
  contains: z.string().optional(), startsWith: z.string().optional(), endsWith: z.string().optional(),
}).partial()
// IntFilter / FloatFilter / BigIntFilter / DateTimeFilter: equals/not/in/notIn/lt/lte/gt/gte (no string ops)
// BoolFilter: equals / not
// Enum<Name>Filter (emitted into filters.ts, imports the enum): equals / not / in / notIn
```

- Each entity `Where` schema: `z.lazy(() => z.object({ <field>: <Filter>.optional(), …,
  AND: z.union([UserWhereSchema, z.array(UserWhereSchema)]).optional(), OR: …, NOT: … }))`.
- **Relations in `Where`**: flat family filters the FK scalar field only (it is already an
  ordinary `Field`). Deep family adds, for a to-one relation,
  `z.lazy(() => <Target>WhereDeepSchema).optional()`; for a to-many,
  `z.object({ some: …, every: …, none: … }).partial().optional()`.

### Relations (`render/relations.ts`) — two families (decided)

| Family | to-one relation | to-many relation |
|---|---|---|
| flat | nothing extra — the FK scalar `Field`(s) (`relation.fkFields`) already carry the id | nothing extra |
| deep | `<Target>DeepSchema` (or `<Target>CreateDeepSchema` in create, etc.), `.optional()` if `relation.optional`, wrapped in `z.lazy(() => …)` | `z.array(z.lazy(() => <Target>DeepSchema))`, `.optional()` |

- **Cross-source relations** (`isCrossSource(fromNs, rel)` true): the deep family cannot
  deterministically import across namespace directories in v1 → it **falls back to the flat
  representation** for that relation (FK id only) and logs at `debug`. Consistent with
  "v1 drivers ignore cross-source" ([ir-model/technical.md](../ir-model/technical.md),
  [core-pipeline/technical.md](../core-pipeline/technical.md)).
- `z.lazy` is used for **every** deep reference (not only detected cycles) — uniform, and
  the entity graph is frequently cyclic.

## Artifact (`artifact.ts`) — the shape the overview deferred here

Fills the core-imposed `GeneratorArtifact` ([core-pipeline/technical.md §Artifact
manifest](../core-pipeline/technical.md#artifact-manifest-generatorartifact)):

```ts
import type { GeneratorArtifact, EntitySymbols } from '@kurotako/core'

// artifact.peerDependencies === { zod: options.zodVersion === 4 ? '^4' : '^3' }
// entities: key === `${namespace}.${entity}`
// EntitySymbols.module === `${namespace}/zod/${entity}.schema`   (post-amendment)
// EntitySymbols.symbols: every generated identifier for that entity, keyed by role:
//   schema, type, createSchema, createType, updateSchema, updateType,
//   whereSchema, whereType, selectSchema, selectType,
//   deepSchema, deepType, createDeepSchema, …  (the full names.ts matrix)

export interface ZodArtifactExtra {
  zodVersion: 3 | 4
  families: ['flat', 'deep']
  variants: ['full', 'create', 'update', 'where', 'select']
  perNamespace: Record<string, {
    enumsModule: string      // `${ns}/enums`
    filtersModule: string    // `${ns}/filters`
    barrelModule: string     // `${ns}`
    enums: Record<string, { constName: string; schemaName: string; typeName: string; module: string }>
  }>
}
```

- `GeneratorArtifact.extra` is `ZodArtifactExtra` — [generator-angular](../generator-angular/overview.md)
  casts it to the type re-exported from `@kurotako/gen-zod`'s barrel (the core boundary
  keeps `extra` as `unknown`, decided in
  [core-pipeline/technical.md](../core-pipeline/technical.md#artifact-manifest-generatorartifact)).
- Angular consumes **`entities[k].symbols` + `extra`, never raw file paths** — this is what
  decouples the two generators and answers
  [docs/vision.md open question §3](../../../../docs/vision.md#open-questions).

## Determinism

Required by [drift-guard](../drift-guard/overview.md):

- `ctx.ir` is already namespace-filtered and key-ordered by core
  ([core-pipeline/technical.md §filter](../core-pipeline/technical.md#orchestration-algorithm-runts));
  the generator preserves that order and never sorts entities/fields.
- enums emitted sorted by name; `import` statements in each file sorted by specifier.
- no timestamps, no absolute paths, no `Date.now()` in generated content. The "generated,
  do not edit" banner is [output-modes](../output-modes/overview.md)' concern, not added
  here.
- `generate` is synchronous and reads nothing outside `ctx`.

## What stays out of this feature

- **Namespace filtering, the DAG order, `VirtualFile` collision detection, the `Writer`,
  the "do not edit" banner, per-namespace `package.json` (mode B)** —
  [core-pipeline](../core-pipeline/overview.md) / [output-modes](../output-modes/overview.md).
- **The `IR` types, validation, traversal helpers** — [`@kurotako/ir`](../ir-model/technical.md).
- **Driver-option file syntax / validation plumbing** — [config-system](../config-system/technical.md)
  (this feature only declares `ZodGeneratorOptions`).
- **Angular types / typed `FormGroup` / `Validators`, and how Angular *uses* the Zod
  artifact** — [generator-angular](../generator-angular/overview.md).
- **A scalar-rendering override map, richer `Select` (`{ select, include }` nesting),
  `orderBy` / pagination schemas, `.brand()` on ids** — post-v1 evolutions, explicitly out.

## Alternatives considered

- **Emit v4 only in v1** (drop the v3 compat mode). Rejected — the overview keeps v3
  reachable; `dialect.ts` isolates the difference to ~15 builder calls, cheaper than a
  later migration for consumers still on `zod@3`.
- **Auto-detect the installed `zod` version.** Rejected — adds filesystem probing and a
  non-deterministic input to a generator that must be pure for `drift-guard`. An explicit
  `zodVersion` option is one line in `tako.config.ts`.
- **Templating the two Zod dialects as two full string templates.** Rejected in favour of
  one AST-ish assembly with a `dialect` seam — the variant/relation/constraint logic is
  identical between v3 and v4; only leaf builders differ.
- **Single schema per entity with relations as optional nested** (the overview's rejected
  option B). Not revisited — the overview settled on two explicit families.
- **Trim the v1 matrix** (flat-only, or drop Where/Select). Rejected by the user — keep the
  full 5 × 2 matrix from v1.
- **Shallow `Where`** (equality only). Rejected by the user — Prisma-style operator objects.
- **One file per variant.** Rejected — one file per entity keeps the import graph flat;
  `z.lazy` already covers the deep-family cycles.
- **Generator returns real files / writes to disk.** Rejected by the core contract: a
  generator returns a `VirtualFile[]`; core has the single I/O site
  ([core-pipeline/technical.md](../core-pipeline/technical.md#alternatives-considered)).
- **`z.nativeEnum` + generated TS `enum`.** Rejected in the overview — `const` array +
  `z.enum` works identically in v3/v4 and avoids TS `enum` semantics; kept here.

## Accepted limitations (v1)

- **`decimal` → `z.string()`**, **`bigint` → `z.bigint()`**, **`json` → `z.unknown()`**,
  **`bytes` → `z.string()`** — no runtime coercion or precision guard. Documented; override
  map deferred.
- **`Constraints.unique` produces nothing** in the schema (it is a persistence constraint,
  not a payload validation rule).
- **Cross-source relations degrade to FK-id** even in the deep family.
- **`Select` is boolean / nested-boolean only** — no `{ select, include, where }` nesting,
  no field arguments.
- **No `orderBy` / pagination / aggregate schemas** — out of v1 scope.
- **The generated tree assumes `zod` is a dependency of the consuming project** — the
  generator does not add it.

## Consequences verified against the repo / other features

- Nothing to migrate: `packages/gen-zod/src/index.ts` is the bootstrap placeholder
  ([task #6](../../tasks/6-package-skeletons.md)). This feature rewrites it; `package.json`
  gains `@kurotako/ir` (`workspace:*`), the `@kurotako/core` / `@kurotako/config` peers, and
  `valibot`. `tsconfig.json` gains the three `references` (small pin for #6 step 2).
- **[ir-model/technical.md](../ir-model/technical.md)** — this generator is the first
  consumer of the traversal helpers and exercises `optional` vs `nullable` (`.optional()` vs
  `.nullable()`), `FieldType.unknown`, `DefaultValue` both kinds, `Relation.fkFields` /
  `cardinality` / `optional`, entity-local vs source-level enum resolution. No IR change
  required; the `StringFormat` closed union already covers every `format` this generator
  maps.
- **[core-pipeline/technical.md](../core-pipeline/technical.md)** — `zodGenerator` matches
  `Generator` (`name`, no `dependsOn`, `generate(ctx)` after config currying); it returns
  `{ files, artifact }` with `<ns>/`-prefixed POSIX paths and fills `GeneratorArtifact`
  (`entities` keyed `${ns}.${entity}`, `extra: ZodArtifactExtra`). Answers the core note
  "role vocabulary settled in generator-zod": roles are `schema`, `type`, `createSchema`,
  `createType`, `updateSchema`, `updateType`, `whereSchema`, `whereType`, `selectSchema`,
  `selectType`, and the `Deep`-suffixed set.
- **[config-system/technical.md](../config-system/technical.md)** — `ZodGeneratorOptions`
  is a plain Valibot object; `@kurotako/config` validates and curries it. `valibot` already
  a dep pattern for option-carrying drivers.
- **[generator-angular/technical.md](../generator-angular/technical.md)** — now a **hard**
  consumer (`dependsOn: ['zod']`). It consumes `entities[k].symbols` (`create*` / `update*`
  / `*Deep*` roles) + `ZodArtifactExtra.perNamespace[ns].enums`, and builds its typed
  `FormGroup` / Signal Forms trees whose validation delegates entirely to the emitted Zod
  schemas — there is no IR-`Validators` path. No `gen-zod` code change; the `Where` /
  `Select` variants are not consumed by Angular.
- **[docs/architecture.md](../../../../docs/architecture.md) / [docs/vision.md](../../../../docs/vision.md)** —
  vision open question §3 (`dependsOn` artifact contract) is now concretely answered on the
  producer side. Reconcile the prose when this lands (doc-only, not this phase).
- **[overview.md](overview.md)** — one refinement to record there: the per-namespace output
  is `enums.ts` + `filters.ts` + `<entity>.schema.ts` + `index.ts`, not just
  `<entity>.schema.ts` + `index.ts`.

## Tests (vitest, colocated)

Fixture-driven: hand-built `IR` objects (via `@kurotako/ir`'s `createSourceIR` + core's
merge, or literal `IR`) fed through `zodGenerator.generate`, asserting the emitted **source
text** and the **artifact structure** (structure, not brittle full-file snapshots — targeted
substring / AST-parse assertions).

- **scalars**: every `ScalarType` → expected builder for `zodVersion: 4` and `: 3`;
  `FieldType.unknown` → `z.unknown()` + hint comment; enum field → `<Enum>Schema` import.
- **constraints**: `minLength`/`maxLength` → `.min`/`.max`; `min`/`max` on numeric;
  `regex` → `.regex(new RegExp(...))`; `format: 'email'` → `z.email()` (v4) vs `.email()`
  (v3); `unique` → no output.
- **optional / nullable**: `nullable` → `.nullable()`; `optional` → `.optional()` in `full`;
  a field with a literal default → `.optional().default(v)` in `create` only; an `expr`
  default → `.optional()` in `create`, absent from `.default()`.
- **variants**: `create` drops the `expr`-default primary key; `update` is `.partial()` and
  omits the primary key; `where` wraps each field in its filter schema and adds
  `AND`/`OR`/`NOT`; `select` is all-boolean (flat) / boolean-or-lazy (deep).
- **families**: flat entity file has no `z.lazy`; deep file references sibling
  `<Target>DeepSchema` via `z.lazy`; to-many → `z.array(z.lazy(...))`.
- **filters.ts**: only the filter schemas for scalar classes actually used are emitted;
  `Enum<Name>Filter` imports the enum.
- **enums.ts**: `const X = [...] as const` + `XSchema = z.enum(X)` + `type X`; entity-local
  enum emitted; same-name distinct defs → `ZodEnumCollisionError`.
- **barrel**: `index.ts` re-exports every file; empty source → still an `index.ts`.
- **cross-source relation**: deep family degrades to FK id + `debug` log.
- **artifact**: `entities` keyed `${ns}.${entity}`, `module === '<ns>/<entity>.schema'`,
  every role present in `symbols`; `extra.zodVersion` echoes the option; `extra.perNamespace`
  lists enum/filter/barrel modules.
- **determinism**: same IR + options → deep-equal `GenOutput` on a second call; entity and
  field order preserved from the IR; import lines sorted.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#32 gen-zod-scaffold](../../tasks/32-gen-zod-scaffold.md) — `package.json` deps,
   `tsconfig` refs, `src/options.ts` (`ZodGeneratorOptions`), `src/errors.ts`,
   `src/names.ts`, `src/dialect.ts` (v3/v4 seam), `src/generator.ts` skeleton, barrel
   (deps: #6, #11, #15, #22).
2. [#33 gen-zod-scalars-constraints](../../tasks/33-gen-zod-scalars-constraints.md) —
   `src/render/scalars.ts` + `constraints.ts` + `field.ts` (dialect-aware base expression,
   constraint chain, list/nullable/optional/default assembly) (deps: #32, #13).
3. [#34 gen-zod-variants-relations](../../tasks/34-gen-zod-variants-relations.md) —
   `src/render/variants.ts` (full/create/update/where/select field sets) +
   `relations.ts` (flat vs deep, cross-source degrade) (dep: #33).
4. [#35 gen-zod-emit-enums-filters](../../tasks/35-gen-zod-emit-enums-filters.md) —
   `src/emit/enums.ts` (const array + `z.enum` + type, collision guard) +
   `filters.ts` (Prisma-style Where operator schemas) (dep: #33).
5. [#36 gen-zod-emit-entity-barrel](../../tasks/36-gen-zod-emit-entity-barrel.md) —
   `src/emit/entity.ts` (per-entity file, all variants × families, sorted imports) +
   `barrel.ts` (`index.ts`) (deps: #34, #35).
6. [#37 gen-zod-artifact-and-run](../../tasks/37-gen-zod-artifact-and-run.md) —
   `src/artifact.ts` (`GeneratorArtifact` + `ZodArtifactExtra`), `generate()` wiring over
   `ctx.ir.sources`, end-to-end + determinism tests (dep: #36).
