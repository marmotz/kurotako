# backend — gen-typescript: emit enums.ts and filters.ts

**Statut** : à faire
**Type** : backend
**Issue** : [#121](https://github.com/marmotz/kurotako/issues/121)

Référence : [../features/generator-typescript/technical.md §Naming](../features/generator-typescript/technical.md#naming-namests--reuse-the-gen-zod-matrix-dto-half-only),
[§Where operator types](../features/generator-typescript/technical.md#where-operator-types-emitfiltersts--port-of-gen-zods-filtersts).

## Constat vérifié

- [`packages/gen-zod/src/emit/enums.ts`](../../packages/gen-zod/src/emit/enums.ts) —
  `collectEnums(source)` (source-level + entity-local, sorted, de-duplicated, collision
  → error). Port; drop the `z.enum(...)` line, keep `const X = [...] as const` +
  `type X = (typeof X)[number]`.
- [`packages/gen-zod/src/emit/filters.ts`](../../packages/gen-zod/src/emit/filters.ts) —
  `SCALAR_FILTER_ORDER`, op sets (`EQUALITY_OPS` / `LIST_OPS` / `ORDER_OPS` /
  `STRING_OPS`), `Enum<Name>Filter` (`equals` / `not` / `in` / `notIn`). Port as TS
  `interface` declarations; base type per class from `scalarTsType`.
- `TypeScriptEnumCollisionError` from `src/errors.ts` (scaffold task).

## À faire

1. `src/emit/enums.ts`: `collectEnums(source)` (port) + `emitEnums(source)` →
   `<ns>/typescript/enums.ts` text: per def, `export const <Name> = [<json values>] as
   const;` + `export type <Name> = (typeof <Name>)[number];`. Distinct same-name defs →
   `TypeScriptEnumCollisionError`.
2. `src/emit/filters.ts`: `emitFilters(source)` → `<ns>/typescript/filters.ts` text.
   One `export interface <Class> { … }` per scalar class actually used by a field
   (optional members: `equals?` / `not?` / `in?: T[]` / `notIn?: T[]` / `lt?` … /
   string ops for `StringFilter`, `equals?` / `not?` only for `BoolFilter`).
   `Enum<Name>Filter` imports the enum type from `./enums` (`import type`).
   `json` / `unknown` fields contribute no class.
3. Tests: `enums.ts` shape; entity-local enum emitted; distinct same-name defs →
   error; `filters.ts` emits only used classes; `Enum<Name>Filter` import; op sets per
   class.

## Dépendances

[118-ts-gen-scaffold](118-ts-gen-scaffold.md) — `names.ts`, `errors.ts`.
