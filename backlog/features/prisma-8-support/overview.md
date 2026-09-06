# Prisma 8 support in `@kurotako/parser-prisma`

**Statut** : conception technique — [technical.md](technical.md)

## Contexte

`@kurotako/parser-prisma` ne couvre aujourd'hui que Prisma ≤ 7, via `getDMMF`
(`@prisma/internals`, peer optionnelle `>=5 <8`). Le mode Prisma 8 — lecture directe
du contrat émis par Prisma 8 — avait été explicitement reporté après kurotako v1 (voir
[`_archives/features/parser-prisma/overview.md`](../../_archives/features/parser-prisma/overview.md)
"Deferred past kurotako v1"). Cette feature est ce fast-follow : Prisma 8 est en RC
(`8.0.0-rc.x`), la finale est imminente et le format du contrat est jugé stabilisé.

Le design v1 a été fait pour ne pas bloquer ce mode : une seule package, deux modes de
version derrière la clé de config `prisma`, détection du format d'entrée
(`*.prisma` / dossier → mode 7, contrat → mode 8) avec override `version`, et une
logique de mapping IR partagée entre modes (`map/build.ts` consomme un `PrismaModel`
neutre). Depuis, le format du contrat Prisma 8 a évolué (codecs de type `pg/text@1`,
`domain.namespaces`, bloc `storage`, `capabilities`, `schemaVersion`) : le design
technique du mode 8 est donc à refaire, pas à recopier.

## Objectif

Ajouter le mode Prisma 8 au parser : consommer un `contract.json` déjà émis
(`prisma contract emit`, à la charge de l'utilisateur), le mapper sur le même
`SourceIR` conforme à
[`@kurotako/ir`](../../_archives/features/ir-model/overview.md) que le mode 7, et livrer
une couverture équivalente (modèles, scalaires, `?`/`[]`, `@id`, `@unique`, `@default`,
relations, enums, types natifs, métadonnées) pour le dialecte PostgreSQL.

## Décisions actées

- **Timing** : conception et implémentation démarrées maintenant contre le format RC
  courant ; la 8.0.0 finale est considérée comme sans changement structurel majeur à
  venir.
- **Entrée : `contract.json` déjà émis, lecture seule.** L'utilisateur lance
  `prisma contract emit` dans son build. Le parser ne lit que `contract.json` (pas
  `contract.d.ts`, canonique = le JSON) et n'a **aucune dépendance `@prisma/*`** dans ce
  mode : parsing JSON + schéma Valibot du contrat. Le parser n'émet jamais le contrat
  lui-même.
- **`schemaVersion` épinglé.** Le parser connaît la ou les versions de `schemaVersion`
  qu'il sait lire ; une version inconnue produit une erreur claire (attendu vs trouvé),
  jamais une lecture best-effort.
- **PostgreSQL d'abord.** Le mapping codec → `ScalarType` / `format` couvre les codecs
  `pg/*` au premier jet. Les autres dialectes (`mysql/*`, `sqlite/*`, `mongo/*`)
  produisent une erreur explicite "dialecte non supporté". L'architecture du mapping est
  conçue dès maintenant pour accueillir MySQL puis les autres (table de codecs par
  dialecte), livrés dans des features ultérieures.
- **1 `contract.json` = 1 namespace kurotako.** Tous les modèles de toutes les
  `domain.namespaces` du contrat sont aplatis sous l'unique namespace kurotako de
  l'instance de parser — cohérent avec le mode 7 (1 schéma = 1 namespace). Les
  identifiants d'entités restent non préfixés
  ([docs/architecture.md](../../../docs/architecture.md)).
- **Alias de collision, deux mécanismes cumulables.** Quand deux namespaces Prisma
  définissent une entité de même nom, l'utilisateur désambiguïse via les options du
  parser :
  - `namespacePrefix: { billing: 'Billing' }` — préfixe toutes les entités d'une
    namespace Prisma donnée (mode 8 uniquement) ;
  - `rename: { 'billing.User': 'BillingUser' }` — renomme une entité précise (prioritaire
    sur le préfixe). Actif dans les deux modes ; en mode 7, la clé est le nom d'entité nu.
  Une collision non résolue par l'un ou l'autre → erreur listant les doublons.
- **m2m : rien à matérialiser en mode 8.** Prisma 8 impose un modèle de jonction explicite
  pour toute relation plusieurs-à-plusieurs (« Many-to-many relations go through an
  explicit join model with a composite primary key »). Le contrat expose donc toujours
  l'entité de jonction ; le parser la remonte telle quelle, sans logique de synthèse. La
  matérialisation reste propre au mode 7 (m2m implicites de Prisma ≤ 7).
- **Codecs : match sur le nom, version tolérée.** La table de mapping codec → `ScalarType`
  est indexée par nom (`pg/text`, `pg/uuid`) ; le suffixe `@N` est lu et loggé mais
  n'empêche pas le mapping tant que la sémantique du codec ne change pas.
- **Les deux modes coexistent indéfiniment.** Le mode 7 (DMMF) n'est pas déprécié ; la
  détection auto reste en place. Un projet Prisma ≤ 7 reste supporté sans changement.

- **Spike d'abord.** La première tâche émet un vrai `contract.json` depuis un projet
  Prisma 8 RC (PostgreSQL) et fige la structure réelle (champs, defaults, enums, uniques,
  index, FK, jointures m2m, doc, `schemaVersion`), comme le spike #59 l'avait fait pour
  `getDMMF`. Le reste du découpage s'appuie sur ses constats.

## Restant à trancher en `technical.md`

- Vocabulaire exact des codecs `pg/*` du contrat → `ScalarType` + `format` + contraintes
  (`maxLength` depuis les types natifs du bloc `storage`).
- Forme précise du `PrismaModel` neutre : vérifier qu'il n'a pas d'hypothèse DMMF-only et
  qu'il accueille aussi bien le contrat que la DMMF.
- Comment le bloc `domain` (modèle logique) et le bloc `storage` (tables/colonnes/types
  natifs) se combinent pour alimenter champs + contraintes.
- Détermination du `schemaVersion` supporté et de la version du générateur reportée dans
  `parserVersion`.
- Nouvelles classes d'erreur (`PrismaContractVersionError`, `PrismaDialectError`,
  `PrismaEntityCollisionError`) et leur remontée via `DriverError`.

## Depends on

- [`_archives/features/parser-prisma`](../../_archives/features/parser-prisma/overview.md)
  — mode 7 (DMMF), livré en kurotako v1. Cette feature en réutilise `map/build.ts`,
  `map/scalars.ts`, `map/relations.ts`, `map/defaults.ts` et le `PrismaModel` neutre.
