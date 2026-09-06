# Intermediate representation (IR)

Settled in the [ir-model](../backlog/_archives/features/ir-model/technical.md) feature and
implemented in `@kurotako/ir` (`schemas.ts` is the single source of truth; TS types are
inferred from the Valibot schemas). This page is the conceptual overview; the package is
authoritative for the exact shape.

The IR has **its own shape** — not modelled on nor inspired by any generator's schema
library, and the serialized form is plain JSON. Its schemas and validation are
implemented with Valibot (schema-first: the TS types are inferred from the schemas), a
choice shared with `@kurotako/core` and the config system.

## Principles

- **Namespace-first**: entity key `(namespace, name)`. No merging of homonyms.
- **Agnostic** of the source and the target. A parser fills the IR; a generator reads it. Nothing specific to Prisma,
  Zod or Angular in the format.
- **Rich enough** to carry types, cardinalities, constraints and relations, without trying to cover from v1 everything
  an ORM can express.

## Shape (sketch)

```ts
interface IR {
  irVersion: string                          // single IR schema version
  sources: Record<string, SourceIR>          // "pg" -> ..., "mongo" -> ...
}

interface SourceIR {
  namespace: string
  parser: string                             // "prisma" | "mongoose" | ...
  parserVersion?: string
  entities: Record<string, Entity>           // "User" -> ...
  enums: Record<string, EnumDef>             // source-level (default); entities may also carry local enums
  typeAliases?: Record<string, TypeAlias>    // named field types (unions, refs, …); absent for parsers that don't produce them
}

interface Entity {
  name: string
  fields: Field[]
  relations: Relation[]
  enums?: Record<string, EnumDef>            // entity-local enums; resolved before source-level
  primaryKey?: string[]                      // field name(s); composite when > 1
  indexes: IndexDef[]                        // { fields, name?, type? }
  uniques: CompositeUnique[]                 // { fields, name? } — composite @@unique
  doc?: string
  dbName?: string                            // @@map
}

interface Field {
  name: string
  type: FieldType
  optional: boolean                          // absent from an input (has a default or is generated)
  nullable: boolean                          // accepts an explicit null
  list: boolean
  constraints: Constraints
  default?: DefaultValue                     // literal or db-side expression
  doc?: string
  dbName?: string                            // @map
}

type FieldType =
  | { kind: 'scalar'; scalar: ScalarType }
  | { kind: 'enum'; ref: string }          // resolved: entity-local enums first, then source-level
  | { kind: 'unknown'; hint?: string }     // escape hatch for unmodelled cases
  | { kind: 'ref'; ref: string }           // bare name, same source: entity first, then typeAliases
  | {                                       // recursive; producers flatten nested unions
      kind: 'union'
      variants: FieldType[]                 // schema tolerates < 2 (normalised in the cross-ref pass)
      discriminator?: { propertyName: string; mapping?: Record<string, string> }  // mapping values name `ref` variants
    }

interface TypeAlias {
  name: string
  type: FieldType                           // any FieldType, including a union
  doc?: string
}

type ScalarType =
  | 'string' | 'boolean'
  | 'int' | 'bigint' | 'float' | 'decimal'
  | 'date' | 'datetime'
  | 'uuid' | 'bytes' | 'json'
// closed union; a new scalar is a minor IR_VERSION bump

type StringFormat =
  | 'email' | 'url' | 'uuid' | 'cuid' | 'cuid2' | 'ulid'
  | 'datetime' | 'date' | 'time' | 'duration'
  | 'ipv4' | 'ipv6'
// closed union; extended by a minor IR_VERSION bump so generators keep exhaustive switches

interface Constraints {
  min?: number                  // numeric lower bound (>=)
  max?: number                  // numeric upper bound (<=)
  minLength?: number
  maxLength?: number
  regex?: string                // free fallback, JS-compatible source
  format?: StringFormat         // named semantic refinement (string scalars only)
  unique?: boolean              // single-field @unique
}

type DefaultValue =
  | { kind: 'value'; value: JsonValue }                 // literal default
  | { kind: 'expr'; expr: string; args?: JsonValue[] }  // db-side: now(), autoincrement(), dbgenerated("...")

interface Relation {
  name: string
  target: { namespace: string; entity: string }   // qualified -> cross-source possible
  cardinality: 'one' | 'many'
  optional: boolean
  owning: boolean                                  // owning side of the relation
  backRelation?: string                            // name of the inverse relation on the target
  fkFields?: string[]                              // scalar field name(s) on THIS entity backing the relation
  references?: string[]                            // field name(s) on the target entity (usually its primary key)
  onDelete?: ReferentialAction
  onUpdate?: ReferentialAction
}

type ReferentialAction = 'cascade' | 'restrict' | 'setNull' | 'setDefault' | 'noAction'

interface EnumDef {
  name: string
  values: EnumValue[]                          // { name, dbName? } — @map on a member is preserved
}
```

## Settled (see [ir-model/technical.md](../backlog/_archives/features/ir-model/technical.md))

- **`ScalarType`**: closed list, `unknown` escape hatch. Semantic string types are
  `string` + `constraints.format`, not scalars.
- **`Decimal` / `bigint` / `Json` / `Bytes`**: named scalars only; runtime representation
  left to each generator.
- **Enums**: both source-level and entity-local, entity-local resolved first.
- **Union types & aliases** (see [ir-union-type/technical.md](../backlog/features/ir-union-type/technical.md)):
  `FieldType` carries `ref` (a same-source name) and `union` (optionally discriminated);
  `SourceIR.typeAliases` is a named-field-type registry. Recursion via `ref` is allowed —
  a cycle is reported informationally, never fatally. Degenerate unions (`< 2` variants)
  are tolerated on read and normalised by generators.
- **Relations**: logical relation + cardinality + `optional` + owning side + back-relation
  + explicit FK field(s) + `references` + `onDelete`/`onUpdate`. Cross-source targets
  allowed at format level, ignored by v1 drivers.
- **Rich constraints**: carried by the IR via the closed `StringFormat` union + `regex`
  fallback.
- **Metadata**: doc comments, `@map`/`@@map`, indexes, composite uniques — in the IR from
  v1.
- **Serialization**: in memory; `--emit-ir` dumps `generated/ir/*.json` on demand.
- **Versioning**: single `irVersion` string (currently `'2'`); `@kurotako/ir` versioned
  independently. `isCompatible` is strict equality, so an `--emit-ir` dump from an older
  `irVersion` is rejected with `version_incompatible`.

## Closed points

1. **`@db.*` / native-type mapping** — settled in
   [parser-prisma/technical.md](../backlog/_archives/features/parser-prisma/technical.md):
   the base scalar is kept and semantics go through `constraints`. `@db.VarChar(n)` /
   `@db.Char(n)` → `maxLength = n`; `@db.Uuid` / `@db.ObjectId` → scalar `uuid`;
   `@db.Date` → scalar `date`; `@db.Time` → `format = 'time'`; unmapped native types are
   ignored (logged at `debug`), never fatal.
2. **`format` vocabulary** — the closed `StringFormat` union above. `parser-prisma`
   populates it from `@db.*` and from `@default(uuid()/cuid()/cuid(2)/ulid())` (scalar
   stays `string`); an unmatched generator (`nanoid()`) records the `default` expression
   with no `format`.
3. **Cross-reference checks** — the Valibot schema covers structure, closed-union
   membership and tagged-union narrowing; a **post-parse cross-reference pass** handles
   enum-ref resolution, relation-target / back-relation resolution, field-name references
   (`primaryKey`, `indexes`, `uniques`, `fkFields`, `references`), a recursive field-type
   walk (`ref` / type-alias resolution, discriminator mapping) and `min <= max` /
   `minLength <= maxLength` / `regex` compilation. Both sources normalise to the stable
   `IrIssue` surface; some checks are `v.rawCheck` pipe actions on the schema.
   Non-fatal observations — degenerate unions and reference cycles — ride a separate
   `info?: IrIssue[]` channel on the `ok: true` branch of `IrValidation`, so `assertIR` /
   `parseIR` stay green while a generator can still log them.
