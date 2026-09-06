# backend — rename/prefix options + mode-8 parser wiring

**Statut** : à faire
**Type** : backend
**Issue** : [#111](https://github.com/marmotz/kurotako/issues/111)

Référence : [../features/prisma-8-support/technical.md §src/options.ts](../features/prisma-8-support/technical.md#srcoptionsts)
et [§src/parser.ts](../features/prisma-8-support/technical.md#srcparserts).

## Constat vérifié

- [`packages/parser-prisma/src/options.ts`](../../packages/parser-prisma/src/options.ts) —
  `v.strictObject({ schema, version: v.picklist([7, 8]) })` (typo = erreur dure).
- [`packages/parser-prisma/src/parser.ts:29-35`](../../packages/parser-prisma/src/parser.ts) —
  la branche `input.mode === 8` lève aujourd'hui
  `PrismaInputError('… not implemented in kurotako v1')`. `watchPaths` / `anchor` gèrent
  déjà le chemin `contract.json` (l.46-58), pas de changement.
- [`packages/parser-prisma/src/dmmf/read.ts`](../../packages/parser-prisma/src/dmmf/read.ts) —
  `toPrismaModel(doc)` : point d'insertion d'une passe finale de rename pour le mode 7.
- [`packages/parser-prisma/src/detect.ts`](../../packages/parser-prisma/src/detect.ts) —
  résolution mode 8 déjà implémentée et testée ; **aucun changement**.

## À faire

1. [`src/options.ts`](../../packages/parser-prisma/src/options.ts) : ajouter deux clés
   optionnelles, validées dans tous les modes —
   `namespacePrefix: v.optional(v.record(v.string(), v.string()))` (mode 8 uniquement ;
   renseignée en mode 7 → log `warn`, sans effet) et
   `rename: v.optional(v.record(v.string(), v.string()))` (deux modes ; clé mode 8 =
   `'namespace.Entity'`, clé mode 7 = `'Entity'`). `v.strictObject` conservé.
2. Créer un module de résolution pur (p. ex. `src/contract/naming.ts`) :
   `resolveNames(models: Array<{ namespace: string; name: string }>, options): Map<string, string>`
   (clé `'<ns>.<name>'` → nom cible), appliquant `rename` prioritaire sur
   `namespacePrefix`, et levant `PrismaEntityCollisionError` si deux modèles retombent sur
   le même nom cible. Consommé par
   [110-prisma8-contract-reader](110-prisma8-contract-reader.md).
3. Mode 7 : dans [`dmmf/read.ts`](../../packages/parser-prisma/src/dmmf/read.ts) (ou une
   passe dans `dmmf/load.ts`), appliquer `rename['<Entity>']` aux noms d'entités **et**
   aux `targetEntity` des `relationEdges`. `namespacePrefix` inerte (pas de namespaces).
4. [`src/parser.ts`](../../packages/parser-prisma/src/parser.ts) : remplacer la branche
   `mode === 8` par la lecture réelle —
   `readFile(input.contractPath, 'utf8')` → `readContract(raw, ctx, options)` →
   `buildSourceIR(ctx.namespace, model, `prisma-contract@${generatorVersion}`, ctx.logger)`.
5. Tests : `options.test.ts` (nouvelles clés acceptées, typo toujours rejetée) ;
   `naming.test.ts` (rename > prefix, collision → erreur, cibles cohérentes) ;
   `parser.test.ts` end-to-end mode 8 sur la fixture du spike (SourceIR complet) ;
   cas mode 7 : `rename` appliqué, `namespacePrefix` → `warn` sans effet.
6. Changeset `minor` (nouveau comportement public `contract.json` + nouvelles classes
   d'erreur exportées). Signaler dans la PR la réconciliation doc à faire
   (`apps/docs` page parser-prisma, `docs/architecture.md` mention « Prisma 8 deferred »).

## Dépendances

[110-prisma8-contract-reader](110-prisma8-contract-reader.md),
[108-prisma8-contract-schema](108-prisma8-contract-schema.md).
