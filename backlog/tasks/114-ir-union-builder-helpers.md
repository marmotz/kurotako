# backend — IR builder + helpers: `f.ref` / `f.union` / `addTypeAlias`, resolution helpers

**Statut** : fait
**Type** : backend
**Issue** : [#114](https://github.com/marmotz/kurotako/issues/114)

Référence : [../features/ir-union-type/technical.md §4](../features/ir-union-type/technical.md#4-builder--packagesirsrcbuilderts),
[§5](../features/ir-union-type/technical.md#5-helpers--packagesirsrchelpersts).

## Constat vérifié

- [`packages/ir/src/builder.ts:46`](../../packages/ir/src/builder.ts) — `FieldBuilder` :
  `scalar` / `enum` / `unknown` posent `#field.type`. `format()`
  ([`builder.ts:225`](../../packages/ir/src/builder.ts)) lève immédiatement un
  `IrBuildError` — modèle de check incrémental.
- [`packages/ir/src/builder.ts:90`](../../packages/ir/src/builder.ts) — `SourceIrBuilder` :
  `addEnum` / `addEntity` / `build`.
- [`packages/ir/src/builder.ts:484`](../../packages/ir/src/builder.ts) —
  `SourceIrBuilderImpl.build()` construit le littéral `SourceIR` (`enums` toujours posé)
  puis `assertSourceIR`.
- [`packages/ir/src/helpers.ts:30`](../../packages/ir/src/helpers.ts) — `resolveEnum`
  (local puis source-level). [`helpers.ts:62`](../../packages/ir/src/helpers.ts) —
  `iterEntities`. [`helpers.ts:157`](../../packages/ir/src/helpers.ts) — `scalarTsType`,
  `switch` non exhaustif-safe sur `scalar` / `enum` / `unknown`.
- [`packages/parser-prisma/src/map/build.ts:103`](../../packages/parser-prisma/src/map/build.ts)
  — seul appelant réel de `createSourceIR` ; ne touche ni `ref` ni `union` ni alias.

## À faire

1. `builder.ts` : `FieldBuilder` gagne `ref(name)` et `union(build: (u: UnionBuilder) =>
   void)`. `UnionBuilder` expose `scalar` / `enum` / `ref` / `union` (imbriqué, aplati au
   build) / `unknown` / `discriminator(propertyName, mapping?)`.
2. `SourceIrBuilder` gagne `addTypeAlias(name, build: (t: TypeAliasBuilder) => void)` ;
   `TypeAliasBuilder` = mêmes setters de type que `UnionBuilder` + `doc(text)`.
   `build()` ([`builder.ts:484`](../../packages/ir/src/builder.ts)) pose `typeAliases`
   dans le littéral seulement si non vide (même garde que `entity.enums`).
3. Checks incrémentaux (lèvent tout de suite, comme `format()`) : `union()` avec `< 2`
   variantes → `IrBuildError` (le builder est plus strict que le schéma) ; valeur de
   `discriminator` mapping qui ne correspond à aucune variante `ref` → `IrBuildError`.
4. `helpers.ts` : ajouter `resolveRef(source, ref)`, `resolveTypeAlias(source, name)`,
   `iterTypeAliases(ir)`, `flattenUnion(unionType)` (aplatit les unions imbriquées,
   dédoublonne structurellement).
5. `helpers.ts` : étendre `scalarTsType` — `ref` → nom du ref verbatim (jamais préfixé,
   ADR-0004) ; `union` → types des variantes joints ` | ` (récursif), parenthésé si
   imbriqué. Le `switch` doit être exhaustif sur le `FieldType` élargi (c'est ce qui
   force `tsc` à signaler tout generator qui oublie une variante).
6. Barrel `index.ts` : exporter les nouveaux helpers et `TypeAlias`.
7. Tests : `builder` (union OK, union à 1 variante rejetée, `addTypeAlias`, mapping
   discriminator invalide) ; `helpers` (`resolveRef` entité vs alias, `flattenUnion`,
   lignes de fixture `scalarTsType` pour `ref` et `union`).

## Dépendances

[112-ir-union-schema-types](112-ir-union-schema-types.md),
[113-ir-union-validation](113-ir-union-validation.md) — `build()` appelle
`assertSourceIR`, qui doit déjà connaître les nouvelles règles.
