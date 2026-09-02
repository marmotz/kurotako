# backend — @kurotako/parser-prisma getDMMF wrapper and neutral PrismaModel shape

**Status**: to do **Type**: backend **Issue**: [#28](https://github.com/marmotz/kurotako/issues/28)

Reference: [../features/parser-prisma/technical.md §Prisma ≤ 7 mode — DMMF acquisition (`dmmf/load.ts`)](../features/parser-prisma/technical.md#prisma--7-mode--dmmf-acquisition-dmmfloadts).

## Verified

- `getDMMF` from `@prisma/internals` (`GetDMMFOptions → Promise<DMMF.Document>`) parses via
  the bundled `prisma-schema-wasm` — no query-engine binary, no post-install download, no
  network. `DMMF.Field` carries `kind`, `isRequired`, `isList`, `isUnique`, `isId`,
  `isUpdatedAt`, `hasDefaultValue`, `type`, `nativeType`, `documentation`, `default`,
  `relationName`, `relationFromFields`, `relationToFields`, `relationOnDelete`,
  `relationOnUpdate`. `DMMF.Model` carries `name`, `dbName`, `primaryKey`, `uniqueIndexes`
  / `uniqueFields`, `documentation`. Field-level `@map` is **not** exposed.
- `@prisma/internals` is a peer dep; it may be absent → `PrismaPeerMissingError`.
- Decided: `map/build.ts` consumes only a mode-neutral `PrismaModel`, so the deferred v8
  reader can produce the same shape.

## To do

1. `packages/parser-prisma/src/dmmf/model.ts` — the neutral shape (plain records, no
   Prisma types leaking out): `PrismaModel { entities: PrismaEntity[]; enums: PrismaEnum[] }`
   with `PrismaEntity { name; dbName?; doc?; fields: PrismaField[]; relationEdges: PrismaRelationEdge[]; primaryKey: string[]; uniques: { fields: string[]; name? }[]; indexes: { fields: string[]; name?; type? }[] }`,
   `PrismaField { name; type; kind: 'scalar'|'enum'|'unsupported'; isList; isRequired; isUnique; isUpdatedAt; hasDefaultValue; nativeType: [string, string[]] | null; default?; doc? }`,
   `PrismaRelationEdge { fieldName; relationName; targetEntity; isList; isRequired; fromFields: string[]; toFields: string[]; onDelete?; onUpdate? }`,
   `PrismaEnum { name; dbName?; doc?; values: { name; dbName?; doc? }[] }`.
2. `packages/parser-prisma/src/dmmf/load.ts`:
   - `export async function readDmmf(input: Extract<ResolvedInput, { mode: 7 }>, logger: Logger): Promise<{ model: PrismaModel; prismaVersion: string }>`.
   - Dynamically resolve `@prisma/internals`; failure → `PrismaPeerMissingError`. Read its
     `package.json` `version` for `prismaVersion`.
   - `kind 'file'` → `getDMMF({ datamodel: content })`. `kind 'folder'` → pass the tuple
     array in the multi-file shape the resolved `@prisma/internals` accepts (verify:
     `datamodel: Array<[string, string]>`). Do **not** set `datasourceOverrides` /
     `previewFeatures`.
   - a `getDMMF` throw → `PrismaSchemaError` (wrap `cause`, keep the Prisma message).
3. `packages/parser-prisma/src/dmmf/read.ts`:
   - `export function toPrismaModel(doc: DMMF.Document): PrismaModel`.
   - Walk `doc.datamodel.models` / `.enums`. Split object fields into `relationEdges`,
     scalar/enum fields into `fields`. `primaryKey` from `model.primaryKey?.fields` or the
     single `isId` field. `uniques` from `model.uniqueIndexes` (fallback `uniqueFields`).
     `indexes` from model indexes **iff** exposed by the pinned version, else `[]` (log at
     `debug`). Carry `documentation` verbatim into `doc`.
4. Wire `parser.ts`: mode 7 → `readDmmf` then `toPrismaModel`; set the builder
   `parserVersion` to `` `prisma@${prismaVersion}` ``.
5. `packages/parser-prisma/src/dmmf/*.test.ts` — fixture `schema.prisma` strings through
   the real `getDMMF`:
   - a model with scalars + an enum → `PrismaModel` with the right split;
   - `@@id([a,b])` → `primaryKey`; `@@unique([x,y])` → `uniques`;
   - `///` doc carried; `@@map` → `dbName`;
   - invalid schema → `PrismaSchemaError`;
   - `@prisma/internals` resolution failure simulated → `PrismaPeerMissingError`.
6. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [26-prisma-parser-scaffold](26-prisma-parser-scaffold.md)
- [27-prisma-input-detection](27-prisma-input-detection.md)
