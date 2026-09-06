# spike — capture the real Prisma 8 `contract.json` structure

**Statut** : à faire
**Type** : spike
**Issue** : [#107](https://github.com/marmotz/kurotako/issues/107)

Référence : [../features/prisma-8-support/technical.md §Spike first (task #1)](../features/prisma-8-support/technical.md#spike-first-task-1).

## Constat vérifié

Le schéma exact de `contract.json` n'est pas entièrement documenté publiquement (Prisma 8
en RC `8.0.0-rc.x`). La doc ne montre que des extraits :
`domain.namespaces.<ns>.models.<M>.{fields,relations}`, `type.codecId` (`pg/text@1`),
`cardinality: "1:N"`, un bloc `storage` non détaillé. Le mode 7 avait été cadré de la même
façon par [le spike #59](../_archives/tasks/59-prisma-getdmmf-spike.md) contre le vrai
`getDMMF` avant d'écrire le reader.

## À faire

1. Dans un projet scratch **hors du dépôt** : installer `prisma@8` (RC), écrire un
   `prisma/contract.prisma` PostgreSQL couvrant tous les cas que kurotako mappe, lancer
   `prisma contract emit`, committer le `contract.json` obtenu comme fixture sous
   `packages/parser-prisma/src/contract/__fixtures__/`.
2. Le `contract.prisma` de la fixture doit exercer : scalaires variés, `String?`,
   listes/tableaux, `@id`, `@@id([a,b])`, `@unique`, `@@unique`, `@@index` (+ type
   d'index si exprimable), `@map` / `@@map` sur champ, modèle et enum, `///` doc sur
   modèle / champ / enum / valeur d'enum, `@default(...)` (fonction DB vs générée type
   `uuid()` / `cuid()`), `@updatedAt`, un `enum` avec et sans valeurs explicites, un
   `type` block (value object), toutes les cardinalités de relation (`1:1`, `1:N`,
   `N:1`, `N:M` via modèle de jonction explicite), `onDelete` / `onUpdate`, et **deux
   `domain.namespaces`** dont une paire de modèles homonymes.
3. Consigner **verbatim** dans une nouvelle section `## Spike findings` de
   [technical.md](../features/prisma-8-support/technical.md) :
   - valeur exacte de `schemaVersion`, de `target` / `targetFamily` pour pg ;
   - chemin de clé exact d'un champ ; forme de `list`/tableau ; distinction
     `nullable` (PSL `?`) vs présence de `default` vs marqueur `@updatedAt` ;
   - représentation de `default` (littéral, fonction DB, fonction générée) ;
   - liste **réelle** des `codecId` `pg/*` émis, et où vit la longueur `@db.VarChar(n)`
     (bloc `storage` ?) ;
   - dans quel bloc (`domain` vs `storage`) atterrissent `@id`, `@unique`, `@@unique`,
     `@@index`, `@@map`, `@map` champ, `///` doc ;
   - noms de clés et vocabulaire de valeurs pour `cardinality`, `onDelete`, `onUpdate` ;
     forme du modèle de jonction `N:M` ;
   - forme d'un enum (`@@type`, membres avec/sans valeur, doc, `@@map`) ;
   - comment un champ référence un `type` block ;
   - champ portant la version du Prisma émetteur (pour `parserVersion`), ou son absence.
4. Réconcilier les sections « spéculatives » de [technical.md](../features/prisma-8-support/technical.md)
   (`### src/contract/`, table des codecs, `### PrismaModel gaps`) avec les constats, et
   ajuster le « À faire » de [108-prisma8-contract-schema](108-prisma8-contract-schema.md),
   [109-prisma8-codec-mapping](109-prisma8-codec-mapping.md) et
   [110-prisma8-contract-reader](110-prisma8-contract-reader.md) si la structure diffère
   des esquisses.

## Dépendances

Aucune. **Bloque** [108-prisma8-contract-schema](108-prisma8-contract-schema.md),
[109-prisma8-codec-mapping](109-prisma8-codec-mapping.md),
[110-prisma8-contract-reader](110-prisma8-contract-reader.md) et
[111-prisma8-options-and-wiring](111-prisma8-options-and-wiring.md).
