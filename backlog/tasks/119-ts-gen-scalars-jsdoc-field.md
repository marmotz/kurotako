# backend — gen-typescript: scalar type, JSDoc, member assembly

**Statut** : à faire
**Type** : backend
**Issue** : [#119](https://github.com/marmotz/kurotako/issues/119)

Référence : [../features/generator-typescript/technical.md §Field type](../features/generator-typescript/technical.md#field-type-renderscalarsts),
[§Member assembly](../features/generator-typescript/technical.md#member-assembly-renderfieldts),
[§JSDoc](../features/generator-typescript/technical.md#jsdoc-renderjsdocts--decided-doc--constraints--unknown-hint).

## Constat vérifié

- [`packages/ir/src/helpers.ts`](../../packages/ir/src/helpers.ts) — `scalarTsType(type)`
  is the mandated scalar → TS-type mapping (`string`/`number`/`bigint`/`boolean`/`Date`/
  `Uint8Array`/`JsonValue`/`unknown`, enum → ref name). Its doc comment forbids
  re-encoding it.
- [`packages/ir/src/schemas.ts:15`](../../packages/ir/src/schemas.ts) — `JsonValue` type
  (recursive) to copy into the emitted `scalars.ts` helper.
- [`packages/ir/src/helpers.ts`](../../packages/ir/src/helpers.ts) — `resolveEnum(source,
  entity, ref)` (entity-local before source-level).
- [`packages/gen-zod/src/render/field.ts`](../../packages/gen-zod/src/render/field.ts) —
  assembly order (base → list → nullable → optional); `gen-typescript` replaces the Zod
  chain with `T[]` / `T | null` / `name?:`.
- [`packages/gen-zod/src/render/constraints.ts`](../../packages/gen-zod/src/render/constraints.ts)
  — the constraint vocabulary to reuse as JSDoc tags.
- [`Field`](../../packages/ir/src/schemas.ts) — `{ name, type, list, optional, nullable,
  constraints, default?, doc? }`; `Constraints` — `min/max/minLength/maxLength/regex/
  format/unique`.

## À faire

1. `src/render/scalars.ts`: `fieldTsType(field, source, entity)` wrapping
   `scalarTsType` — resolve an `enum` ref through `resolveEnum` first, and record when
   `JsonValue` / an enum name is used (for the import block and `scalars.ts` emission).
   Return the bare non-list, non-nullable type string.
2. `src/render/jsdoc.ts`: `jsDoc(field)` → `/** … */` block or `''`. Order:
   `field.doc` prose lines, blank line, then `@min` / `@max` / `@minLength` /
   `@maxLength` / `@pattern <source>` / `@format <name>` / `@unique` from
   `field.constraints`, then `@default <json>` for a `{ kind: 'value' }` default, then an
   `unknown` / `unknown: <hint>` line for a `{ kind: 'unknown' }` type. Documentation
   only — never affects the type.
3. `src/render/field.ts`: `memberLine(field, { optional }, source, entity)` →
   `<jsdoc>\n  <name><?>: <type>;` with `list` → `<type>[]` (parenthesise unions),
   `nullable` → `<type> | null`, `optional` → `?` on the key.
4. `src/emit/scalars.ts`: `emitScalars()` → the `export type JsonValue = …` helper text
   (copied from `packages/ir/src/schemas.ts`). Caller decides whether to emit the file.
5. Tests: every `ScalarType` → expected token for v4-free output; `json` → `JsonValue`;
   enum field → resolved name; `unknown` → `unknown` + hint; `list`/`nullable`/`optional`
   rendering; JSDoc tag rendering and the no-JSDoc case.

## Dépendances

[118-ts-gen-scaffold](118-ts-gen-scaffold.md) — `names.ts`, package skeleton.
