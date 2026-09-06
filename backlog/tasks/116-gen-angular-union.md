# front — gen-angular: union control typing, discriminated sub-FormGroup, fallback

**Statut** : à faire
**Type** : front
**Issue** : [#116](https://github.com/marmotz/kurotako/issues/116)

Référence : [../features/ir-union-type/technical.md §8](../features/ir-union-type/technical.md#8-gen-angular-impact).

## Constat vérifié

- [`packages/gen-angular/src/render/controls.ts:29`](../../packages/gen-angular/src/render/controls.ts)
  — `baseType` : `switch` sur `scalar` / `enum` / `unknown`.
- [`packages/gen-angular/src/render/controls.ts:41`](../../packages/gen-angular/src/render/controls.ts)
  — `controlType` enveloppe `list` puis `nullable`.
- [`packages/gen-angular/src/render/controls.ts:70`](../../packages/gen-angular/src/render/controls.ts)
  — `zeroValue`, littéral non-null toujours assignable.
- [`packages/gen-angular/src/render/controls.ts:132`](../../packages/gen-angular/src/render/controls.ts)
  — `controlExpr` : `new FormControl<T>(...)` vs `nonNullable`.
- [`packages/gen-angular/src/zod-artifact.ts:87`](../../packages/gen-angular/src/zod-artifact.ts)
  — résolution d'un ref via `extra.perNamespace[ns].enums` ; modèle pour lire les
  symboles d'alias exposés par gen-zod (`entities[k].symbols.type`).
- [`packages/gen-angular/src/emit/runtime.ts`](../../packages/gen-angular/src/emit/runtime.ts)
  — `zod-forms.runtime.ts` généré (emplacement du switch runtime).
- [`packages/gen-angular/src/artifact.ts:84`](../../packages/gen-angular/src/artifact.ts)
  — `buildArtifact` via `iterEntities`.

## À faire

1. `render/controls.ts` : `baseType` gère
   - `ref` → nom du type DTO de l'alias / entité cible (via symbole `type` de l'artifact
     zod) ;
   - `union` → types des variantes joints ` | `.
   `controlType` conserve l'enveloppe `list` / `nullable`.
2. Union **discriminée** (`discriminator` présent) → sous-`FormGroup` : un `FormGroup`
   dont les contrôles sont indexés par valeur du discriminant, chacun un
   `FormGroup<<Variant>FormControls>` construit depuis la variante `ref` résolue. Ajouter
   un switch runtime dans `zod-forms.runtime.ts` qui bascule le sous-groupe actif sur le
   `valueChanges` du contrôle discriminant.
3. Repli : pas de `discriminator`, ou **branche récursive** (canal `info` de la
   validation) → `FormControl<A | B>` (ou `FormControl<unknown>` si une variante est
   elle-même récursive) + commentaire `// union: validated by zodValidator(schema)` +
   `logger.warn`.
4. `zeroValue` : `ref` / union non discriminée → `'undefined'` ; union discriminée →
   sous-objet zéro de la première variante.
5. `artifact.ts` : symboles de formulaire pour les groupes adossés à un alias, comme
   gen-zod.
6. Changeset `minor` `@kurotako/gen-angular`.
7. Tests : snapshot du sous-`FormGroup` discriminé + test de compilation du switch
   runtime ; repli `FormControl` + warning ; repli branche récursive.

## Dépendances

[115-gen-zod-union](115-gen-zod-union.md) — consomme les symboles d'alias exposés dans
l'artifact zod.
