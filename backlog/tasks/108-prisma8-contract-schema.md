# backend — Prisma 8 contract module scaffold: Valibot schema, version guard, errors

**Statut** : à faire
**Type** : backend
**Issue** : [#108](https://github.com/marmotz/kurotako/issues/108)

Référence : [../features/prisma-8-support/technical.md §src/contract/ (new)](../features/prisma-8-support/technical.md#srccontract-new)
et [§src/errors.ts (new classes)](../features/prisma-8-support/technical.md#srcerrorsts-new-classes).

## Constat vérifié

- [`packages/parser-prisma/src/errors.ts`](../../packages/parser-prisma/src/errors.ts) —
  trois classes `extends TakoError` (`PrismaInputError`, `PrismaPeerMissingError`,
  `PrismaSchemaError`), codes `prisma_input` / `prisma_peer_missing` / `prisma_schema`.
- [`packages/parser-prisma/src/index.ts`](../../packages/parser-prisma/src/index.ts) —
  ré-exporte les trois classes + `PrismaParserOptions` + `prismaParser`.
- `package.json` : peer `@prisma/internals` `>=5 <8` (optionnelle), dev `@prisma/dmmf` +
  `@prisma/internals` `7.10.0`.
- `@kurotako/ir` n'a **aucune** dépendance Prisma ; `valibot` est déjà une `dependencies`
  du package.

## À faire

1. Créer `packages/parser-prisma/src/contract/schema.ts` : schéma Valibot en
   `v.looseObject` à chaque niveau (Prisma ajoutera des clés — ne pas casser dessus),
   typant uniquement les chemins consommés par kurotako : `schemaVersion`, `target`,
   `targetFamily`, `domain.namespaces.<ns>.models.<M>.{fields,relations,storage}` et le
   sous-arbre `storage` utile (colonnes, types natifs, clés, uniques, index, FK). Exporter
   un `parseContract(raw: string)` qui `JSON.parse` puis `v.parse`, et lève
   `PrismaContractError` (cf. étape 3) en portant le chemin de l'issue Valibot.
2. Créer `packages/parser-prisma/src/contract/version.ts` :
   `const SUPPORTED_SCHEMA_VERSIONS = new Set([...])` (valeur(s) figée(s) par le spike),
   et `assertSupportedVersion(found: string)` qui lève `PrismaContractVersionError`
   (message : attendu vs trouvé) si non supporté. Jamais best-effort.
3. Ajouter dans [`src/errors.ts`](../../packages/parser-prisma/src/errors.ts) quatre
   classes `extends TakoError` :
   - `PrismaContractError` — code `prisma_contract` — JSON invalide ou schéma Valibot en
     échec ;
   - `PrismaContractVersionError` — code `prisma_contract_version` ;
   - `PrismaDialectError` — code `prisma_dialect` — un préfixe de codec autre que `pg/`
     (message : nomme le dialecte + renvoie à la limitation « PostgreSQL d'abord ») ;
   - `PrismaEntityCollisionError` — code `prisma_entity_collision` — deux modèles du
     contrat se réduisent au même nom d'entité après rename/prefix (message : liste les
     paires `<ns>.<Model>` en collision + le nom gagnant).
4. Les ré-exporter depuis [`src/index.ts`](../../packages/parser-prisma/src/index.ts).
5. Ajouter `prisma@8` (RC) en `devDependencies` du package (émission de fixtures + smoke
   test). Peer `@prisma/internals` `>=5 <8` **inchangée**.
6. Tests colocalisés : `schema.test.ts` (contrat valide accepté, clé inconnue tolérée,
   JSON invalide → `PrismaContractError`, structure invalide → `PrismaContractError` avec
   chemin) ; `version.test.ts` (version supportée OK, inconnue → `PrismaContractVersionError`).

## Dépendances

[107-prisma8-contract-spike](107-prisma8-contract-spike.md) — la fixture et la valeur de
`schemaVersion` en sortent.
