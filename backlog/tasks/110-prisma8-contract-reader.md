# backend — Prisma 8 `contract.json` -> `PrismaModel` reader

**Statut** : à faire
**Type** : backend
**Issue** : [#110](https://github.com/marmotz/kurotako/issues/110)

Référence : [../features/prisma-8-support/technical.md §src/contract/ (new)](../features/prisma-8-support/technical.md#srccontract-new)
(sous-section `read.ts`) et [§PrismaModel gaps (dmmf/model.ts)](../features/prisma-8-support/technical.md#prismamodel-gaps-dmmfmodelts).

## Constat vérifié

- [`packages/parser-prisma/src/dmmf/model.ts`](../../packages/parser-prisma/src/dmmf/model.ts) —
  `PrismaModel { entities: PrismaEntity[]; enums: PrismaEnum[] }`, forme neutre déjà
  conçue pour être produite par le reader de contrat. `PrismaEntity` porte `name`,
  `dbName?`, `doc?`, `fields`, `relationEdges`, `primaryKey`, `uniques`, `indexes`.
  `PrismaRelationEdge` : `fieldName`, `relationName`, `targetEntity`, `isList`,
  `isRequired`, `fromFields`, `toFields`, `onDelete?`, `onUpdate?`.
- [`packages/parser-prisma/src/map/build.ts`](../../packages/parser-prisma/src/map/build.ts) —
  consomme uniquement `PrismaModel` ; `nullable ← !isRequired`,
  `optional ← hasDefaultValue || isUpdatedAt`.
- [`packages/parser-prisma/src/map/relations.ts`](../../packages/parser-prisma/src/map/relations.ts) —
  `buildRelations` groupe les edges par `relationName`, déduit le côté propriétaire de
  `fromFields.length > 0` ; `isImplicitM2M` exige 2 edges `isList` sans `fromFields`/`toFields`.

## À faire

1. Créer `packages/parser-prisma/src/contract/read.ts` :
   `readContract(raw: string, ctx: ParseContext, options): { model: PrismaModel; generatorVersion: string }`.
   Pur, total, sans accès disque, **sans import `@prisma/*`**.
2. Étapes :
   - `parseContract(raw)` (schéma Valibot) puis `assertSupportedVersion(schemaVersion)` ;
   - parcourir **toutes** les `domain.namespaces`, aplatir en une seule liste d'entités
     (1 contrat = 1 namespace kurotako) ;
   - appliquer la politique rename/prefix (fournie par
     [111-prisma8-options-and-wiring](111-prisma8-options-and-wiring.md), consommée ici) :
     nom cible = `rename['<ns>.<Model>']` sinon `(namespacePrefix['<ns>'] ?? '') + Model` ;
     collision résiduelle → `PrismaEntityCollisionError` ; réécrire `to.model` /
     `to.namespace` des relations via la même map ;
   - pour chaque champ : `mapCodec(codecId)` → `type` / `scalarOverride` ; si
     `needsLength`, lire la longueur dans le bloc `storage` de la colonne → `maxLength` ;
     `isRequired = !nullable` ; `hasDefaultValue` = présence de `default` ; `isUpdatedAt`
     depuis le marqueur du contrat (spike) ; `default` → forme `PrismaDefault`
     (littéral vs `{ name, args }`) attendue par
     [`map/defaults.ts`](../../packages/parser-prisma/src/map/defaults.ts) ;
   - relations : à partir de `cardinality` (`1:1` / `1:N` / `N:1` / `N:M`) + `on`
     (`localFields` / `targetFields`), **synthétiser les deux `PrismaRelationEdge`** (côté
     propriétaire = celui dont la colonne FK est dans `storage`) pour que
     `map/relations.ts:buildRelations` fonctionne sans modification. `N:M` : modèle de
     jonction explicite déjà présent dans le contrat → produire ses edges directement, ne
     **jamais** déclencher `isImplicitM2M` (les deux côtés portent `fromFields`) ;
   - `primaryKey` / `uniques` / `indexes` (+ type d'index) / `dbName` / `doc` depuis
     `storage` + `domain` ;
   - enums : membres et `doc` depuis le `domain` (le codec `@@type` est ignoré pour l'IR) ;
   - `type` blocks (value objects) → champ `FieldType { kind: 'unknown' }` ;
   - `generatorVersion` = champ de version de l'émetteur Prisma dans `contract.json`, à
     défaut `schemaVersion`.
3. Si le spike révèle un besoin de champ `PrismaModel` réellement inévitable, l'ajouter
   **optionnel** dans [`dmmf/model.ts`](../../packages/parser-prisma/src/dmmf/model.ts) ;
   le mode 7 le laisse non renseigné.
4. Tests colocalisés `read.test.ts`, fixture-driven (fixture du spike) : voir la liste de
   [technical.md §Tests](../features/prisma-8-support/technical.md#tests-vitest-colocated)
   (codecs, nullable/optional, clés, relations toutes cardinalités, `N:M` sans entité
   synthétique, enums, namespaces/collisions, version, erreurs, déterminisme).

## Dépendances

[108-prisma8-contract-schema](108-prisma8-contract-schema.md),
[109-prisma8-codec-mapping](109-prisma8-codec-mapping.md).
La résolution rename/prefix est définie dans
[111-prisma8-options-and-wiring](111-prisma8-options-and-wiring.md) — se coordonner sur
la signature (fonction pure prenant `options` + la liste `(ns, model)`).
