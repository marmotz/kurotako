# backend — @kurotako/parser-prisma getDMMF wrapper and neutral PrismaModel shape

**Status**: done **Type**: backend **Issue**: [#28](https://github.com/marmotz/kurotako/issues/28)

Reference: [../features/parser-prisma/technical.md §Prisma ≤ 7 mode — DMMF acquisition (`dmmf/load.ts`)](../features/parser-prisma/technical.md#prisma--7-mode--dmmf-acquisition-dmmfloadts).

## Verified (spike [#59](59-prisma-getdmmf-spike.md))

- `getDMMF` from `@prisma/internals` (`getDMMF(options): Promise<DMMF.Document>`) parses via
  the bundled `prisma-schema-wasm` — **no query-engine binary and no network at the call**.
  Confirmed against `@prisma/internals` 5.22 / 6.19 / 7.10.
- **Call shape** (`GetDMMFOptions`, stable v5–v7): `{ datamodel: SchemaFileInput }`,
  `SchemaFileInput = string | Array<[filename, content]>`. Single file → the string;
  folder → the tuple array (order irrelevant). Do **not** pass `datamodelPath` (gone after
  v5), `previewFeatures` (gone after v6), or `datasourceOverrides` (rejected in v7).
- **CJS-only package**: `import { getDMMF } from '@prisma/internals'` does not work under
  Node ESM. Resolve dynamically: `require.resolve('@prisma/internals', { paths: [ctx.cwd] })`
  then `await import(...)` / `createRequire`.
- **Error**: a schema error throws `GetDmmfError extends Error`, `err.name === 'GetDmmfError'`,
  the P1012 text in `err.message`, no structured fields → wrap into `PrismaSchemaError`
  (`message` + `cause` + namespace).
- `DMMF.Field` carries `kind`, `isRequired`, `isList`, `isUnique`, `isId`, `isUpdatedAt`,
  `hasDefaultValue`, `type`, `nativeType: [name, string[]] | null`, `documentation`,
  `default` (literal or `{ name, args }`), `relationName`, `relationFromFields`,
  `relationToFields`, `relationOnDelete`, `relationOnUpdate`. `DMMF.Model` carries `name`,
  `dbName`, `primaryKey {name, fields}`, `uniqueIndexes [{name, fields}]`, `uniqueFields`,
  `documentation`. **No `indexes` key** — non-unique `@@index` is not in the DMMF.
  Field-level `@map` is **not** exposed.
- `@prisma/internals` is a peer dep (`>=5 <8`); it may be absent → `PrismaPeerMissingError`
  with hint `add @prisma/internals@<major> as a devDependency`. On Prisma 7 this is the
  nominal path (the v7 `prisma` CLI no longer pulls `@prisma/internals`).
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
   - Dynamically resolve `@prisma/internals` from `ctx.cwd`
     (`require.resolve('@prisma/internals', { paths: [ctx.cwd] })`, then `await import`);
     failure → `PrismaPeerMissingError` with the install hint. Read its `package.json`
     `version` for `prismaVersion`.
   - `kind 'file'` → `getDMMF({ datamodel: content })`. `kind 'folder'` →
     `getDMMF({ datamodel: [[relPath, content], …] })` (tuple array, confirmed by #59). Do
     **not** set `datamodelPath` / `datasourceOverrides` / `previewFeatures`.
   - a `getDMMF` throw (`GetDmmfError`, message-only) → `PrismaSchemaError` (wrap `cause`,
     keep `err.message`).
3. `packages/parser-prisma/src/dmmf/read.ts`:
   - `export function toPrismaModel(doc: DMMF.Document): PrismaModel`.
   - Walk `doc.datamodel.models` / `.enums`. Split object fields into `relationEdges`,
     scalar/enum fields into `fields`. `primaryKey` from `model.primaryKey?.fields` or the
     single `isId` field. `uniques` from `model.uniqueIndexes` (fallback `uniqueFields`).
     `indexes` is always `[]` in DMMF mode (#59: `DMMF.Model` exposes no `indexes` key).
     Carry `documentation` verbatim into `doc`.
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
