# backend — gen-zod: union / ref rendering, `aliases.ts` emit, artifact symbols

**Statut** : à faire
**Type** : backend
**Issue** : [#115](https://github.com/marmotz/kurotako/issues/115)

Référence : [../features/ir-union-type/technical.md §7](../features/ir-union-type/technical.md#7-gen-zod-impact).

## Constat vérifié

- [`packages/gen-zod/src/render/scalars.ts:59`](../../packages/gen-zod/src/render/scalars.ts)
  — `baseExpr` : `switch` sur `scalar` / `enum` / `unknown`. `baseClass`
  ([`scalars.ts:21`](../../packages/gen-zod/src/render/scalars.ts)) renvoie `'other'` hors
  scalaire.
- [`packages/gen-zod/src/render/field.ts:18`](../../packages/gen-zod/src/render/field.ts)
  — `fieldExpr` enchaîne `applyConstraints` puis `z.array` / `.nullable()` / `.optional()`
  / `.default()`.
- [`packages/gen-zod/src/render/relations.ts`](../../packages/gen-zod/src/render/relations.ts)
  — machinerie `z.lazy` de la famille `Deep` (à réutiliser pour les refs récursifs).
- [`packages/gen-zod/src/names.ts`](../../packages/gen-zod/src/names.ts) — helpers
  d'identifiants + module specifiers (`entityModule`, `enumsModule`, `filtersModule`,
  `barrelModule`).
- [`packages/gen-zod/src/generator.ts:29`](../../packages/gen-zod/src/generator.ts) —
  `Object.values(source.entities)` ; wiring des émetteurs.
- [`packages/gen-zod/src/emit/barrel.ts:11`](../../packages/gen-zod/src/emit/barrel.ts),
  [`emit/enums.ts`](../../packages/gen-zod/src/emit/enums.ts),
  [`emit/filters.ts`](../../packages/gen-zod/src/emit/filters.ts) — modèle des émetteurs
  transverses.
- [`packages/gen-zod/src/artifact.ts:86`](../../packages/gen-zod/src/artifact.ts) —
  `buildArtifact` : `entities[`${ns}.${entity}`]` via `iterEntities` (entités
  uniquement), `symbols` = matrice `names.ts`.
- `z.discriminatedUnion(name, [...])` a la même signature en Zod v3 et v4 ; vérifier
  quand même via [`dialect.ts`](../../packages/gen-zod/src/dialect.ts).

## À faire

1. `render/scalars.ts` : `baseExpr` gère
   - `ref` → `` `${refName}Schema` ``, enveloppé `z.lazy(() => …)` si le ref est dans un
     cycle (canal `info` de la validation), sinon référence nue ;
   - `union` → `z.union([<exprs variantes>])` ; avec `discriminator` →
     `z.discriminatedUnion('<propertyName>', [<exprs>])`.
   `baseClass` renvoie `'other'` pour `ref` / `union`.
2. Nouveau `emit/aliases.ts` → `<ns>/zod/aliases.ts` : par alias,
   `export const <Name>Schema = <expr>;` + `export type <Name> = z.infer<typeof
   <Name>Schema>;`. Itérer `ir.sources[ns].typeAliases` (pas `iterEntities`).
3. `names.ts` : `aliasSchemaName(name)`, `aliasModule(ns)`.
4. `generator.ts` : câbler `aliases.ts` à côté de `enums.ts` / `filters.ts` ;
   `emit/barrel.ts` ajoute la ré-export `./aliases` quand des alias existent.
5. `artifact.ts` : une entrée `entities[`${ns}.${aliasName}`]` par alias, `symbols:
   { schema: '<Name>Schema', type: '<Name>' }`, `module: aliasModule(ns)`.
6. Réutiliser le wrapper `z.lazy` de `render/relations.ts` pour les refs récursifs
   d'entités / alias.
7. Changeset `minor` `@kurotako/gen-zod`.
8. Tests : snapshots `z.union` / `z.discriminatedUnion` / `z.lazy` ; émission
   `aliases.ts` ; artifact expose les symboles d'alias ; test de compilation `tsc` sur
   une sortie avec alias récursif.

## Dépendances

[114-ir-union-builder-helpers](114-ir-union-builder-helpers.md) — `scalarTsType` élargi,
helpers `resolveRef` / `iterTypeAliases`, types `FieldType` / `TypeAlias`.
