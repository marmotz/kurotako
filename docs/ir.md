# Intermediate representation (IR)

Draft. Most points are now settled in the
[ir-model](../backlog/features/ir-model/overview.md) feature (see its "Decisions made");
the remaining "open" points are to be closed in that feature's `technical.md`.

The IR has **its own shape** — not modelled on nor inspired by any generator's schema
library, and the serialized form is plain JSON. Its schemas and validation are
implemented with Valibot (schema-first: the TS types are inferred from the schemas), a
choice shared with `@kurotako/core` and the config system.

## Principles

- **Namespace-first** ([ADR-0004](adr/0004-ir-namespace-first.md)): entity key
  `(namespace, name)`. No merging of homonyms.
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
  entities: Record<string, Entity>           // "User" -> ...
  enums: Record<string, EnumDef>             // source-level (default); entities may also carry local enums
}

interface Entity {
  name: string
  fields: Field[]
  relations: Relation[]
  enums?: Record<string, EnumDef>            // entity-local enums; resolved before source-level
  doc?: string
  dbName?: string                            // @@map
  indexes: IndexDef[]
  uniques: string[][]                        // composite unique constraints
}

interface Field {
  name: string
  type: FieldType
  optional: boolean
  list: boolean
  constraints: Constraints
  doc?: string
  dbName?: string                            // @map
}

type FieldType = | { kind: 'scalar'; scalar: ScalarType } | { kind: 'enum'; ref: string } | { kind: 'json' } | {
  kind: 'unknown';
  hint?: string
}        // escape hatch for unmodeled cases

type ScalarType =
  | 'string'
  | 'boolean'
  | 'int'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'bytes'
  | 'uuid'

// exact list: open

interface Constraints {
  min?: number;
  max?: number                  // numeric bound
  minLength?: number;
  maxLength?: number
  regex?: string                // free fallback
  format?: string               // named vocabulary: 'email' | 'url' | 'uuid' | 'cuid' | 'datetime' | ...
  unique?: boolean
  default?: unknown
}

interface Relation {
  name: string
  target: { namespace: string; entity: string }   // qualified -> cross-source possible
  cardinality: 'one' | 'many'
  optional: boolean
  owning: boolean                                  // owning side of the relation
  backRelation?: string                            // name of the inverse relation on the target
  fkFields?: string[]                              // explicit foreign-key field(s)
  onDelete?: ReferentialAction
  onUpdate?: ReferentialAction
}

type ReferentialAction = 'cascade' | 'restrict' | 'setNull' | 'setDefault' | 'noAction'

interface EnumDef {
  name: string
  values: string[]                            // named values + literal: open
}
```

## Settled (see [ir-model/overview.md](../backlog/features/ir-model/overview.md))

- **`ScalarType`**: closed list, `unknown` escape hatch. Semantic string types are
  `string` + `constraints.format`, not scalars.
- **`Decimal` / `bigint` / `Json` / `Bytes`**: named scalars only; runtime representation
  left to each generator.
- **Enums**: both source-level and entity-local, entity-local resolved first.
- **Relations**: logical relation + cardinality + `optional` + owning side + back-relation
  + explicit FK field(s) + `onDelete`/`onUpdate`. Cross-source targets allowed at format
  level, ignored by v1 drivers.
- **Rich constraints**: carried by the IR via a named `format` vocabulary + `regex`
  fallback.
- **Metadata**: doc comments, `@map`/`@@map`, indexes, composite uniques — in the IR from
  v1.
- **Serialization**: in memory; `--emit-ir` dumps `generated/ir/*.json` on demand.
- **Versioning**: single `irVersion` string; `@kurotako/ir` versioned independently.

## Open points

1. Exact `@db.*` / native-type mapping from Prisma to the closed `ScalarType` list.
2. Exact `format` vocabulary and how far parsers populate it.
3. Which cross-reference checks stay outside Valibot (post-parse pass) vs are expressed
   as `v.rawCheck` pipe actions.
