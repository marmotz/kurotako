# backend — IR schema + types: `ref` / `union` field kinds, `TypeAlias`, IR_VERSION 2

**Statut** : à faire
**Type** : backend
**Issue** : [#112](https://github.com/marmotz/kurotako/issues/112)

Référence : [../features/ir-union-type/technical.md §1](../features/ir-union-type/technical.md#1-schema-changes--packagesirsrcschemasts),
[§2](../features/ir-union-type/technical.md#2-type-surface--packagesirsrctypests),
[§6](../features/ir-union-type/technical.md#6-ir_version--packagesirsrcversionts).

## Constat vérifié

- [`packages/ir/src/schemas.ts:82`](../../packages/ir/src/schemas.ts) — `FieldTypeSchema`
  est un `v.variant('kind', [scalar, enum, unknown])`, non récursif.
- [`packages/ir/src/schemas.ts:21`](../../packages/ir/src/schemas.ts) — `JsonValueSchema`
  est déjà un `v.lazy` avec annotation `v.GenericSchema<JsonValue>` + type écrit à la main
  ([`schemas.ts:13`](../../packages/ir/src/schemas.ts)) : précédent à suivre.
- [`packages/ir/src/schemas.ts:181`](../../packages/ir/src/schemas.ts) — `SourceIrSchema`
  a `entities` et `enums` (`v.record`), pas de registre d'alias. `Entity.enums` est
  `v.optional(v.record(...))` ([`schemas.ts:173`](../../packages/ir/src/schemas.ts)) —
  précédent pour une clé optionnelle.
- [`packages/ir/src/types.ts`](../../packages/ir/src/types.ts) — tout est
  `v.InferOutput<typeof …Schema>` sauf `JsonValue` (réexporté de `schemas.ts`).
- [`packages/ir/src/version.ts:6`](../../packages/ir/src/version.ts) — `IR_VERSION = '1'`,
  `isCompatible` = égalité stricte.
- [`packages/ir/src/types.test-d.ts`](../../packages/ir/src/types.test-d.ts) — assertions
  de types.

## À faire

1. `schemas.ts` : passer `FieldTypeSchema` en `v.lazy(() => v.variant('kind', [...]))`
   annoté `v.GenericSchema<FieldType>`, en ajoutant deux variantes :
   - `{ kind: 'ref', ref: v.string() }` ;
   - `{ kind: 'union', variants: v.array(FieldTypeSchema),
     discriminator: v.optional(v.object({ propertyName: v.string(),
     mapping: v.optional(v.record(v.string(), v.string())) })) }`.
   Ne **pas** contraindre `variants.length >= 2` au niveau schéma (toléré, normalisé en
   cross-ref — cf. §3 du technical).
2. `schemas.ts` : ajouter `TypeAliasSchema = v.object({ name, type: FieldTypeSchema,
   doc: v.optional(v.string()) })` et une clé `typeAliases: v.optional(v.record(v.string(),
   TypeAliasSchema))` sur `SourceIrSchema`.
3. `types.ts` : `FieldType` devient un type union écrit à la main (récursif), sur le
   modèle de `JsonValue` ; ajouter `export type TypeAlias = v.InferOutput<typeof
   TypeAliasSchema>`. `SourceIR` reste inféré.
4. `version.ts` : `IR_VERSION = '2'`. `isCompatible` inchangé (égalité stricte).
5. `types.test-d.ts` : assertion sur la forme récursive de `FieldType` (une `union` dont
   une variante est une `union`) et sur `TypeAlias`.
6. Tests `schemas` / round-trip : `ref`, `union`, union imbriquée, union discriminée,
   `SourceIR` avec `typeAliases` — parse + `JSON.parse(JSON.stringify(...))` stable.
7. Changeset `minor` pour `@kurotako/ir` mentionnant le bump `IR_VERSION` (peut être
   posé ici ou regroupé dans la tâche d'intégration — cohérence à garder).

## Dépendances

Aucune.
