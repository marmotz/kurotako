# backend — IR validation: recursive field-type walk, alias pass, cycle info channel

**Statut** : à faire
**Type** : backend
**Issue** : [#113](https://github.com/marmotz/kurotako/issues/113)

Référence : [../features/ir-union-type/technical.md §3](../features/ir-union-type/technical.md#3-validation--packagesirsrcvalidatets).

## Constat vérifié

- [`packages/ir/src/validate.ts:18`](../../packages/ir/src/validate.ts) — `IrIssueCode`
  est une union fermée de chaînes.
- [`packages/ir/src/validate.ts:137`](../../packages/ir/src/validate.ts) — `checkSource`
  reçoit `lookupEntity` / `isNamespacePresent` (vue this-source-only en
  `validateSourceIR`, complète en `validateIR`).
- [`packages/ir/src/validate.ts:168-192`](../../packages/ir/src/validate.ts) — la boucle
  sur `entity.fields` ne regarde `field.type` que pour `kind === 'enum'`.
- [`packages/ir/src/validate.ts:38`](../../packages/ir/src/validate.ts) — `IrValidation<T>`
  = `{ ok: true; value: T } | { ok: false; issues: IrIssue[] }`. Pas de canal
  informationnel.
- `IrValidationError` ([`validate.ts:42`](../../packages/ir/src/validate.ts)) ne porte que
  les issues fatales.

## À faire

1. `validate.ts` : étendre `IrIssueCode` avec `unresolved_ref`, `unresolved_type_alias`,
   `type_alias_key_mismatch`, `degenerate_union`, `union_cycle`.
2. Écrire `walkFieldType(type, path, ctx)` récursif remplaçant la branche `kind === 'enum'`
   de la boucle `entity.fields` :
   - `enum` → résolution existante (local puis source-level) ;
   - `ref` → résoudre contre `source.entities` puis `source.typeAliases` →
     `unresolved_ref` si absent ;
   - `union` → récursion sur chaque `variants[]` ; `variants.length < 2` →
     `degenerate_union` (canal `info`, non fatal) ; si `discriminator?.mapping`, chaque
     valeur doit désigner une variante `ref` présente → `unresolved_type_alias` ;
   - `scalar` / `unknown` → rien.
3. Ajouter une passe `typeAliases` : pour chaque entrée, contrôle clé == `name`
   (`type_alias_key_mismatch`), puis `walkFieldType(alias.type, ...)`.
4. Détection de cycle **informative** : DFS sur les arêtes `ref` (field-type, alias.type,
   variante d'union). Un cycle ne produit **pas** d'issue fatale (récursion autorisée) —
   il alimente le canal `info`, code `union_cycle`.
5. Étendre `IrValidation` : ajouter `info?: IrIssue[]` sur la branche `ok: true`.
   `degenerate_union` et `union_cycle` passent par `info`. `assertIR` / `parseIR` restent
   verts en présence de `info`. `IrValidationError` inchangé.
6. Câbler dans `validateSourceIR` (vue this-source-only) et `validateIR` (par source
   après merge). Le `ref` cross-source n'existe pas en v1 (pas de qualifieur dans le
   schéma) — rien à gérer.
7. Tests : fixture par nouveau code d'issue ; cycle → `info` et non échec ; union
   dégénérée tolérée en lecture ; `assertIR` d'un IR avec `info` ne lève pas.

## Dépendances

[112-ir-union-schema-types](112-ir-union-schema-types.md) — les variantes `ref` / `union`
et `SourceIR.typeAliases` doivent exister.
