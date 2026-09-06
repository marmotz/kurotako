# backend — Prisma 8 codec -> IR ScalarType / format mapping (PostgreSQL)

**Statut** : à faire
**Type** : backend
**Issue** : [#109](https://github.com/marmotz/kurotako/issues/109)

Référence : [../features/prisma-8-support/technical.md §src/contract/ (new)](../features/prisma-8-support/technical.md#srccontract-new)
(sous-section `codecs.ts`).

## Constat vérifié

- [`packages/parser-prisma/src/map/scalars.ts`](../../packages/parser-prisma/src/map/scalars.ts) —
  mode 7 : `SCALAR_TABLE` fermée `String -> string`, etc. ; `refineNative` gère
  `@db.VarChar(n)` → `maxLength`, `@db.Uuid` → `uuid`, `@db.Date` → `date`,
  `@db.Time` → `format: 'time'`. Renvoie `MappedFieldType { type, constraints, scalarOverride? }`.
- `@kurotako/ir` : `ScalarType` = `string | boolean | int | bigint | float | decimal |
  date | datetime | uuid | bytes | json`
  ([`packages/ir/src/schemas.ts:34`](../../packages/ir/src/schemas.ts)) ; `StringFormat`
  inclut `time`, `uuid`, `cuid`, `cuid2`, `ulid`, `date`, `datetime`, … ; `FieldType`
  a une variante `{ kind: 'unknown', hint? }`.

## À faire

1. Créer `packages/parser-prisma/src/contract/codecs.ts` : table indexée par **nom de
   codec sans le suffixe `@N`** (`pg/text`, `pg/uuid`, …) → `ScalarType` + éventuel
   `format` / besoin de longueur. Cible (à confirmer/compléter avec la liste réelle du
   spike) :

   | Codec | IR |
   |---|---|
   | `pg/text`, `pg/varchar`, `pg/char`, `pg/citext` | `string` |
   | `pg/bool` | `boolean` |
   | `pg/int2`, `pg/int4` | `int` |
   | `pg/int8` | `bigint` |
   | `pg/float4`, `pg/float8` | `float` |
   | `pg/numeric` | `decimal` |
   | `pg/uuid` | `uuid` |
   | `pg/timestamp`, `pg/timestamptz` | `datetime` |
   | `pg/date` | `date` |
   | `pg/time`, `pg/timetz` | `datetime` + `format: 'time'` |
   | `pg/jsonb`, `pg/json` | `json` |
   | `pg/bytea` | `bytes` |

2. Exporter `mapCodec(codecId: string, logger?): { type: FieldType; scalarOverride?; format?; needsLength?: boolean }` :
   - parser le nom + la version `@N` ; logger la version au niveau `debug` ; matcher sur
     le nom seul (un bump `pg/text@2` reste `string` tant que la sémantique tient) ;
   - préfixe autre que `pg/` → lever `PrismaDialectError` (échec de tout le parse) ;
   - `pg/*` inconnu → `FieldType { kind: 'unknown', hint: codecId }` + log `debug`,
     jamais fatal ;
   - `needsLength` signale au reader de récupérer la longueur dans le bloc `storage` du
     champ pour poser `constraints.maxLength`.
3. Tests colocalisés `codecs.test.ts` : chaque codec mappé → `ScalarType` attendu ;
   `pg/text@1` et `pg/text@2` → `string` ; `pg/foo` inconnu → `unknown` + hint ;
   `mysql/int4` → `PrismaDialectError` ; `pg/time` → `datetime` + `format: 'time'`.

## Dépendances

[107-prisma8-contract-spike](107-prisma8-contract-spike.md) — liste réelle des codecs ;
[108-prisma8-contract-schema](108-prisma8-contract-schema.md) — `PrismaDialectError`.
