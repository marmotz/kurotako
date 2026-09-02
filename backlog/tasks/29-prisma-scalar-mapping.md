# backend — @kurotako/parser-prisma scalar, native-type, format and default mapping

**Status**: to do **Type**: backend **Issue**: [#29](https://github.com/marmotz/kurotako/issues/29)

Reference: [../features/parser-prisma/technical.md §Scalars (`map/scalars.ts`)](../features/parser-prisma/technical.md#scalars-mapscalarsts),
[§Native `@db.*` types → scalar refinement + constraints](../features/parser-prisma/technical.md#native-db-types--scalar-refinement--constraints),
[§String `format` from generator defaults](../features/parser-prisma/technical.md#string-format-from-generator-defaults) and
[§Defaults (`map/defaults.ts`)](../features/parser-prisma/technical.md#defaults-mapdefaultsts).

## Verified

- The IR `StringFormat` closed list already covers `uuid` / `cuid` / `cuid2` / `ulid`;
  `ScalarType` has `uuid`, `date`, `datetime`, `decimal`, `bigint`, `json`, `bytes`
  ([ir-model/technical.md §Schemas and type surface](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)).
- `DefaultValue` is a `v.variant('kind', …)` with `{ kind: 'value', value }` and
  `{ kind: 'expr', expr, args? }`.
- Decided: native semantics go through `format`; `uuid` scalar only for
  `@db.Uuid` / `@db.ObjectId`.

## To do

1. `packages/parser-prisma/src/map/scalars.ts`:
   - `export function mapFieldType(f: PrismaField): { type: FieldType; constraints: Constraints; scalarOverride?: ScalarType }`.
   - base scalar table: `String→string`, `Boolean→boolean`, `Int→int`, `BigInt→bigint`,
     `Float→float`, `Decimal→decimal`, `DateTime→datetime`, `Json→json`, `Bytes→bytes`;
     `kind: 'unsupported'` → `{ kind: 'unknown', hint: f.type }`; `kind: 'enum'` →
     `{ kind: 'enum', ref: f.type }`.
   - `nativeType` refinement: `VarChar|Char|NVarChar|String(n) → constraints.maxLength = n`;
     `Uuid|ObjectId → scalar 'uuid'`; `Date → scalar 'date'`;
     `Time|Timetz → constraints.format = 'time'`; `Text|Citext|Xml|…` → no-op; numeric
     native types → no-op in v1. Unknown native type → ignored, `logger.debug`.
2. `packages/parser-prisma/src/map/defaults.ts`:
   - `export function mapDefault(raw: PrismaField['default']): { default?: DefaultValue; format?: StringFormat }`.
   - literal / array / enum string → `{ kind: 'value', value }`.
   - `{ name: 'now' } → { kind: 'expr', expr: 'now()' }`;
     `{ name: 'autoincrement' } → 'autoincrement()'`;
     `{ name: 'dbgenerated', args } → { kind: 'expr', expr: 'dbgenerated', args }`.
   - `{ name: 'uuid' | 'cuid' | 'ulid' | 'nanoid' }` → `{ kind: 'expr', expr: '<fn>()' }`
     plus `format` `uuid` / `cuid` (or `cuid2` when `args` denote v2) / `ulid`; `nanoid`
     → no `format`.
3. `packages/parser-prisma/src/map/*.test.ts`:
   - every Prisma scalar → expected `ScalarType`; `Unsupported("x")` → `unknown` hint `x`;
   - `@db.VarChar(120)` → `maxLength: 120`; `@db.Uuid` → scalar `uuid`; `@db.Date` → `date`;
   - `@default(uuid())` → scalar stays `string`, `format: 'uuid'`, `default` expr;
     `@default(nanoid())` → expr, no `format`;
   - `@default(now())` / `@default(autoincrement())` / `@default(dbgenerated("gen_random_uuid()"))`
     → expected `DefaultValue`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [28-prisma-dmmf-reader](28-prisma-dmmf-reader.md)
