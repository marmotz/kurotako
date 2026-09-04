# IR model — technical design

Design for `@kurotako/ir`. Product decisions come from [overview.md](overview.md); the
format sketch and its rationale live in [docs/ir.md](../../../docs/ir.md). This document
turns them into a concrete type surface and package API.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) scaffolds
  `packages/ir/` with a single `src/index.ts` exporting a `version` const and one trivial
  test. This feature replaces that placeholder with the real module.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API** — the package must run unmodified on Node and Bun.
- Consumers, none implemented yet: `@kurotako/core` (merge + validate), every `parser-*`
  (builder), every `gen-*` (types + helpers). Contracts drafted in
  [docs/architecture.md](../../../docs/architecture.md).
- Relevant design decisions (see [docs/architecture.md](../../../docs/architecture.md)):
  namespaces, cross-source qualified targets; key `(namespace, entity)`, no homonym merge.

## Package shape

Single entry point (keeps the `exports` map identical to the bootstrap skeleton and to
what mode B emits — [docs/architecture.md](../../../docs/architecture.md)). No subpath
exports in v1.

```
packages/ir/src/
  index.ts        # barrel: re-exports the modules below
  version.ts      # IR_VERSION, isCompatible()
  schemas.ts      # every Valibot schema — the single source of truth for the format
  types.ts        # type aliases, all `v.InferOutput<typeof …Schema>` (no runtime code)
  validate.ts     # assertIR / validateIR / parseIR — Valibot parse + cross-ref checks
  builder.ts      # createSourceIR() fluent builder
  helpers.ts      # traversal / resolution helpers
  *.test.ts       # colocated vitest suites
```

`package.json`: `"sideEffects": false` (every export is pure) so `gen-*` importing only
types/helpers tree-shakes `builder`/`validate` away. **One runtime dependency: `valibot`**
(tree-shakeable; pulled in only by `schemas`/`validate`/`builder`, erased for
types-only importers).

## Schemas and type surface (`schemas.ts` + `types.ts`)

`schemas.ts` holds the Valibot schemas and is the **single source of truth**. `types.ts`
is derived: every type below is `export type X = v.InferOutput<typeof XSchema>`, no
hand-written interface. Closed unions (`ScalarType`, `StringFormat`, `ReferentialAction`,
index `type`) are `v.picklist([...])`; tagged unions (`FieldType`, `DefaultValue`) are
`v.variant('kind', [...])`; `Record<string, T>` maps are `v.record(v.string(), TSchema)`.

All types stay plain and JSON-serializable by construction: no classes, no `Date`, no
`RegExp` (regex carried as a `string`), no functions — the schemas only use primitive,
object, array, record, picklist and variant. This is what keeps `--emit-ir` and `parseIR`
trivial. The documented shape (what the schemas encode):

```ts
export interface IR {
  irVersion: string                       // === IR_VERSION at build time
  sources: Record<string, SourceIR>       // key === SourceIR.namespace (invariant, checked)
}

export interface SourceIR {
  namespace: string
  parser: string                          // driver short name, e.g. "prisma"
  parserVersion?: string                  // traceability / cache key, optional
  entities: Record<string, Entity>        // key === Entity.name
  enums: Record<string, EnumDef>          // source-level enums (default scope)
}

export interface Entity {
  name: string
  fields: Field[]
  relations: Relation[]
  enums?: Record<string, EnumDef>         // entity-local; resolved before source-level
  primaryKey?: string[]                   // field names; composite supported (@@id)
  indexes: IndexDef[]                     // @@index
  uniques: CompositeUnique[]              // @@unique (multi-field); single-field @unique -> Constraints.unique
  doc?: string
  dbName?: string                         // @@map
}

export interface Field {
  name: string
  type: FieldType
  list: boolean                           // array field ([])
  optional: boolean                       // may be absent (e.g. on a create payload)
  nullable: boolean                       // accepts null
  constraints: Constraints
  default?: DefaultValue
  doc?: string
  dbName?: string                         // @map
}

export type FieldType =
  | { kind: 'scalar'; scalar: ScalarType }
  | { kind: 'enum'; ref: string }         // resolved: entity-local enums first, then source-level
  | { kind: 'unknown'; hint?: string }    // escape hatch for unmodelled cases

export type ScalarType =
  | 'string' | 'boolean'
  | 'int' | 'bigint' | 'float' | 'decimal'
  | 'date' | 'datetime'
  | 'uuid' | 'bytes' | 'json'
// closed list. A new scalar is a minor IR_VERSION bump.

export interface Constraints {
  min?: number                            // numeric lower bound (>=)
  max?: number                            // numeric upper bound (<=)
  minLength?: number
  maxLength?: number
  regex?: string                          // free fallback, JS-compatible source
  format?: StringFormat                   // named semantic refinement
  unique?: boolean                        // single-field @unique
}

export type StringFormat =
  | 'email' | 'url' | 'uuid' | 'cuid' | 'cuid2' | 'ulid'
  | 'datetime' | 'date' | 'time' | 'duration'
  | 'ipv4' | 'ipv6'
// closed list; extended by a minor IR_VERSION bump so generators keep exhaustive switches.

export type DefaultValue =
  | { kind: 'value'; value: JsonValue }              // literal default
  | { kind: 'expr'; expr: string; args?: JsonValue[] } // db-side: now(), autoincrement(), dbgenerated("...")

export interface Relation {
  name: string
  target: RelationTarget                   // qualified; cross-source allowed at format level
  cardinality: 'one' | 'many'
  optional: boolean                        // nullable to-one / possibly-empty association
  owning: boolean                          // this side carries the foreign key
  backRelation?: string                    // name of the inverse Relation on the target entity
  fkFields?: string[]                       // scalar Field name(s) on THIS entity backing the relation
  references?: string[]                     // Field name(s) on the target entity (usually its primaryKey)
  onDelete?: ReferentialAction
  onUpdate?: ReferentialAction
}

export interface RelationTarget { namespace: string; entity: string }

export type ReferentialAction =
  | 'cascade' | 'restrict' | 'setNull' | 'setDefault' | 'noAction'

export interface EnumDef {
  name: string
  values: EnumValue[]
  doc?: string
  dbName?: string                          // @@map on the enum
}

export interface EnumValue {
  name: string
  dbName?: string                          // @map on the value
  doc?: string
}

export interface IndexDef {
  fields: string[]
  name?: string
  type?: 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'spgist'
}

export interface CompositeUnique {
  fields: string[]
  name?: string
}

export type JsonValue =
  | null | boolean | number | string
  | JsonValue[] | { [k: string]: JsonValue }
```

### Notes on modelling choices

- **`optional` vs `nullable`** kept distinct (decided): lets `gen-zod` emit `.optional()`
  vs `.nullable()` and disambiguates create/update variants. Prisma `?` maps to
  `nullable: true`.
- **Relations separate from `fields[]`** (matches the sketch: relations are
  reasoned per namespace and can be cross-source). The backing scalar column stays a
  normal `Field` (e.g. `authorId`), referenced by `relation.fkFields`.
- **`primaryKey` at entity level**, not a `Field.id` flag — a boolean can't express
  composite `@@id`.
- **Enum values as objects** `{ name, dbName? }` — carries `@map` on values, consistent
  with "all metadata from v1".
- **`format` and `ScalarType` as closed unions** — generators can `switch` exhaustively.
  A newer parser emitting an unknown `format` against an older `@kurotako/ir` fails
  validation, which correctly surfaces the version mismatch rather than silently dropping
  it.
- **`regex` as `string`, no `Date`/class anywhere** — the IR is structurally
  `JSON.parse(JSON.stringify(ir))`-stable, which is the whole basis for `--emit-ir`.

## Versioning (`version.ts`)

```ts
export const IR_VERSION = '1'
export function isCompatible(irVersion: string): boolean  // v1: strict equality
```

- Single version string, incremented only on a **format** breaking change — orthogonal to
  the npm semver of `@kurotako/ir` (independent versioning,
  [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)).
- The core calls `isCompatible(ir.irVersion)` after merge and each driver may re-check;
  incompatibility is a hard error with both versions in the message.

## Runtime validation (`validate.ts`)

**Valibot-backed, schema-first** (decided). `validate.ts` runs `v.safeParse` against the
`schemas.ts` schema, then a small **cross-reference pass** for the checks Valibot cannot
express structurally (enum-ref resolution, relation-target / back-relation resolution,
field-name references, `min <= max`). Valibot issues and cross-ref issues are both
normalised to the stable `IrIssue` surface below (dotted, located paths), so consumers
(`@kurotako/core`) are unaffected by the switch.

```ts
export interface IrIssue { path: string; code: IrIssueCode; message: string }
export type IrIssueCode =
  | 'version_incompatible' | 'namespace_key_mismatch' | 'entity_key_mismatch'
  | 'duplicate_field' | 'duplicate_enum_value' | 'unresolved_enum_ref'
  | 'unresolved_field_ref' | 'unresolved_relation_target' | 'unresolved_back_relation'
  | 'invalid_constraint' | 'invalid_regex' | 'shape'

export type IrValidation<T> = { ok: true; value: T } | { ok: false; issues: IrIssue[] }

export function validateIR(value: unknown): IrValidation<IR>
export function validateSourceIR(value: unknown): IrValidation<SourceIR>
export function assertIR(value: unknown): asserts value is IR      // throws IrValidationError
export function assertSourceIR(value: unknown): asserts value is SourceIR
export function parseIR(json: string): IR                          // JSON.parse + assertIR
```

Structural shape, closed-union membership, required/optional keys and tagged-union
narrowing come from the Valibot schema. Checks performed **in the cross-reference pass**
(and, where noted, as `v.rawCheck` pipe actions on the schema):

| Check | Scope |
|---|---|
| `sources[k].namespace === k` | IR |
| `entities[k].name === k`, `enums[k].name === k` | SourceIR |
| no duplicate `Field.name` within an entity; no duplicate `EnumValue.name` | Entity / EnumDef |
| `FieldType {kind:'enum'}` ref resolves (entity-local, then source-level) | Field |
| `primaryKey`, `indexes[].fields`, `uniques[].fields`, `fkFields` name existing fields | Entity |
| relation `target.namespace === self` → target entity exists; other namespace present → exists; namespace absent → `shape`-level info only (v1 drivers ignore cross-source) | IR |
| `backRelation` names a relation on the target entity (when target resolvable) | Relation |
| `references` name existing fields on the target entity | Relation |
| `min <= max`, `minLength <= maxLength`, `regex` compiles via `new RegExp` | Constraints |
| `irVersion` compatible | IR |

`validateSourceIR` runs everything that does not require the cross-namespace view;
`validateIR` runs the full set after merge.

## Builder (`builder.ts`)

Fluent, with incremental validation (decided). A parser builds one `SourceIR`; the core
merges.

```ts
export function createSourceIR(init: { namespace: string; parser: string; parserVersion?: string }): SourceIrBuilder

interface SourceIrBuilder {
  addEnum(name: string, def: (e: EnumBuilder) => void): this
  addEntity(name: string, def: (e: EntityBuilder) => void): this
  build(): SourceIR   // runs assertSourceIR; throws IrBuildError with the located path
}

interface EntityBuilder {
  field(name: string, def: (f: FieldBuilder) => void): this
  relation(name: string, def: (r: RelationBuilder) => void): this
  localEnum(name: string, def: (e: EnumBuilder) => void): this
  primaryKey(...fields: string[]): this
  index(fields: string[], opts?: { name?: string; type?: IndexDef['type'] }): this
  unique(fields: string[], opts?: { name?: string }): this
  doc(text: string): this
  dbName(name: string): this
}

interface FieldBuilder {
  scalar(t: ScalarType): this
  enum(ref: string): this
  unknown(hint?: string): this
  list(): this
  optional(): this
  nullable(): this
  primary(): this                 // shorthand: adds this field to the entity primaryKey
  unique(): this
  min(n): this; max(n): this; minLength(n): this; maxLength(n): this
  regex(src: string): this
  format(f: StringFormat): this
  default(d: DefaultValue): this
  doc(text: string): this; dbName(name: string): this
}
// RelationBuilder: .to(namespace, entity) / .one() / .many() / .optional() / .owning()
//                  .backRelation(name) / .fkFields(...) / .references(...) / .onDelete(a) / .onUpdate(a)
// EnumBuilder:     .value(name, opts?) / .doc(text) / .dbName(name)
```

Incremental validation: duplicate field name, `format()` on a non-string type, `primary()`
on a `list` field, unknown `ScalarType` → throw immediately with a path like
`pg.User.email`. `build()` runs the full `assertSourceIR` as the final gate.

Example:

```ts
const src = createSourceIR({ namespace: 'pg', parser: 'prisma' })
  .addEnum('Role', e => e.value('USER').value('ADMIN', { dbName: 'admin' }))
  .addEntity('User', e => {
    e.field('id', f => f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }))
    e.field('email', f => f.scalar('string').format('email').unique())
    e.field('role', f => f.enum('Role').default({ kind: 'value', value: 'USER' }))
    e.relation('posts', r => r.to('pg', 'Post').many().backRelation('author'))
  })
  .build()
```

## Helpers (`helpers.ts`)

```ts
export function getSource(ir: IR, namespace: string): SourceIR | undefined
export function resolveEntity(ir: IR, namespace: string, name: string): Entity | undefined
export function resolveEnum(source: SourceIR, entity: Entity | undefined, ref: string): EnumDef | undefined
export function resolveRelationTarget(ir: IR, fromNamespace: string, rel: Relation): Entity | undefined
export function isCrossSource(fromNamespace: string, rel: Relation): boolean
export function* iterEntities(ir: IR): Iterable<{ namespace: string; entity: Entity }>
export function* iterFields(entity: Entity): Iterable<Field>
export function primaryKeyFields(entity: Entity): Field[]
```

Pure, no throw (return `undefined` on miss). `resolveEnum` implements the entity-local →
source-level precedence in one place so every generator agrees.

### Shared-decision helpers (`helpers.ts`)

**Principle: any rule that a parser or a generator would otherwise re-implement "in its
own way" — a modelling decision taken at one point in time — lives here as a pure helper,
so the whole pipeline reads it from one place.** The `create` / `update` payload-shape
rules are the first case: `parser-prisma` sets `Field.optional`,
[generator-zod](../generator-zod/technical.md#variant-field-sets-rendervariantsts) derives
the `create` / `update` field sets, and
[generator-angular](../generator-angular/technical.md#variant-field-sets) re-derives the
*same* sets for its control tree. Three call sites, one rule → it is a helper, not prose
to copy.

```ts
// value is assigned by the DB/server (expr default: now(), autoincrement(), uuid(), …) —
// never supplied on a create payload
export function isDbAssigned(field: Field): boolean

// scalar/enum fields to include in a "create" payload: entity.fields minus the ones whose
// only value source is db-side (a primary-key member that is isDbAssigned)
export function createFields(entity: Entity): Field[]

// a create-payload field the caller may omit: field.optional (IR) || field.default != null
// || isDbAssigned(field)
export function isCreateOptional(field: Field): boolean

// scalar/enum fields to include in an "update" payload: entity.fields minus primary-key
// members; the caller treats every one as optional (partial)
export function updateFields(entity: Entity): Field[]

// TS type a non-nullable, non-list value of this field maps to, as a source string —
// the single scalar→TS mapping every generator's typed output must agree on. Returns
// one of the closed `ScalarTsType` tokens for a scalar, the enum type name for
// { kind: 'enum' } (never prefixed), 'unknown' for { kind: 'unknown' }.
export type ScalarTsType =
  | 'string' | 'number' | 'bigint' | 'boolean' | 'Date' | 'Uint8Array' | 'JsonValue' | 'unknown'
export function scalarTsType(type: FieldType): string
```

Scalar mapping (decided): `string` / `uuid` / `decimal` → `'string'` (`decimal` kept as a
string to preserve precision; runtime representation stays each generator's choice),
`boolean` → `'boolean'`, `int` / `float` → `'number'`, `bigint` → `'bigint'`, `date` /
`datetime` → `'Date'`, `bytes` → `'Uint8Array'`, `json` → `'JsonValue'` (the recursive type
re-exported by `@kurotako/ir`).

Pure, deterministic, exhaustively switched over the closed unions. `technical.md` /
task [#13](../../tasks/13-ir-traversal-helpers.md) pin the exact predicate bodies with a
fixture table; `generator-zod` (#34) and `generator-angular` (#39) **must** consume these
rather than re-encode them.

## Out of scope here (owned by other features)

- `mergeIR(sources: SourceIR[]): IR` and the duplicate-namespace rejection —
  [core-pipeline](../core-pipeline/overview.md). It calls `assertIR` from this package.
- `--emit-ir` flag and where the dump file lands — [cli](../cli/overview.md) /
  core-pipeline. `@kurotako/ir` only guarantees `parseIR` / JSON-stability.
- Prisma type → `ScalarType` / `format` mapping table —
  [parser-prisma](../parser-prisma/overview.md).
- `format` → `z.email()` etc. and `default.kind` handling —
  [generator-zod](../generator-zod/overview.md),
  [generator-angular](../generator-angular/overview.md).

## Alternatives considered

- **Hand-written zero-dependency assertions** instead of a validation library. Rejected
  (reversed from the initial design): re-develops structural validation, JSON-shape
  guards and union narrowing that Valibot already provides, and would mean three
  hand-rolled validators across `ir`, `core` and `config-system`. Valibot is
  tree-shakeable, its issues normalise cleanly to `IrIssue`, and the serialized IR stays
  plain JSON so the format is still consumable without kurotako. **Zod** rejected against
  Valibot on bundle size; **ajv** rejected (JSON-Schema authoring, weaker TS inference).
- **`FieldType` as a flat `scalar: ScalarType | { enumRef: string }`** rather than a
  tagged union. Rejected: the tagged `kind` gives generators an exhaustive `switch`.
- **Relations embedded in `fields[]`** (Prisma's own shape). Rejected: relations are
  qualified and possibly cross-source; a separate `relations[]` keeps the
  scalar field list clean and the cross-source target explicit.
- **`format` as a free `string`**. Rejected: a closed union lets generators switch
  exhaustively and turns an unknown value from a newer parser into a visible version
  error.
- **Merge/version living in `@kurotako/ir`**. Kept the package to types + validation +
  builder + helpers; orchestration stays in `core` so `ir` has no notion of config or
  multiple parsers running.

## Consequences verified against the current repo

- Nothing to migrate: `packages/ir/src/index.ts` is a bootstrap placeholder. This feature
  rewrites it into the module set above; the `tsconfig.json` / `tsup.config.ts` /
  `vitest.config.ts` from bootstrap #6 are unchanged (single entry). `packages/ir/package.json`
  gains one dependency: `"valibot"`.
- `core-pipeline`'s open question "shape of the parser contract `parse(ctx) -> SourceIR`"
  is now concrete: the return type is `SourceIR` from this package, and parsers are
  expected to produce it via `createSourceIR(...).build()`.
- `parser-prisma`'s open questions on `Decimal` / `BigInt` / `Bytes` / `Json`
  representation are answered at the IR level (named scalars, representation left to
  generators); only the Prisma-side mapping stays open in that feature.
- **`generator-zod` / `generator-angular`** — the `create` / `update` payload-shape rules
  and the scalar → TS type mapping they both need are now `@kurotako/ir` shared-decision
  helpers (`createFields`, `isCreateOptional`, `updateFields`, `isDbAssigned`,
  `scalarTsType`). Both generators **consume** them; neither re-encodes the rule. Their
  variant sections / tasks [#34](../../tasks/34-gen-zod-variants-relations.md) /
  [#39](../../tasks/39-gen-angular-controls-variants.md) are updated accordingly. No new IR
  data — pure functions over the existing `Entity` / `Field`.
- Tests (vitest, colocated): valid/invalid IR fixtures for every `IrIssueCode`; builder
  incremental-throw cases; helper resolution including an entity-local enum shadowing a
  source-level one; the shared-decision-helper fixture table
  ([task #13](../../tasks/13-ir-traversal-helpers.md)); round-trip
  `parseIR(JSON.stringify(ir))` equality.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#11 ir-schemas-types-version](../../tasks/11-ir-types-and-version.md) — `src/schemas.ts`
   Valibot schemas (source of truth) + `src/types.ts` (`v.InferOutput` aliases) +
   `src/version.ts` (`IR_VERSION`, `isCompatible`), barrel wiring, `valibot` dependency
   (dep: #6).
2. [#12 ir-runtime-validation](../../tasks/12-ir-runtime-validation.md) — `src/validate.ts`
   `validateIR`/`assertIR`/`parseIR` = Valibot `safeParse` + cross-reference pass, issues
   normalised to `IrIssue` (dep: #11).
3. [#13 ir-traversal-helpers](../../tasks/13-ir-traversal-helpers.md) — `src/helpers.ts`
   resolution / iteration helpers (dep: #11).
4. [#14 ir-source-builder](../../tasks/14-ir-source-builder.md) — `src/builder.ts` fluent
   `createSourceIR()` with incremental validation (deps: #11, #12).
