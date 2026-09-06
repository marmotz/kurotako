# backend — IR Valibot schemas, inferred types and version module

**Status**: done **Type**: backend **Issue**: [#11](https://github.com/marmotz/kurotako/issues/11)

Reference: [../features/ir-model/technical.md §Schemas and type surface (`schemas.ts` + `types.ts`)](../features/ir-model/technical.md#schemas-and-type-surface-schemasts--typests)
and [§Versioning (`version.ts`)](../features/ir-model/technical.md#versioning-versionts).

## Verified

- `packages/ir/` is scaffolded by [#6](6-package-skeletons.md) with a placeholder
  `src/index.ts` (`export const version`) and one trivial test. This task replaces the
  placeholder with the real module skeleton.
- Decided: the IR is **schema-first on Valibot** — schemas are the source of truth, types
  are `v.InferOutput`. `@kurotako/ir` gains one runtime dependency, `valibot`.
- Package must stay single entry point, run unmodified on Node and Bun (no `Bun.*`).

## To do

1. `packages/ir/package.json` — add `"valibot"` to `dependencies`.
2. `packages/ir/src/schemas.ts` — the Valibot schema for every node of the format:
   `IrSchema`, `SourceIrSchema`, `EntitySchema`, `FieldSchema`, `FieldTypeSchema`
   (`v.variant('kind', …)`), `ScalarTypeSchema` / `StringFormatSchema` /
   `ReferentialActionSchema` (`v.picklist`), `ConstraintsSchema`, `DefaultValueSchema`
   (`v.variant('kind', …)`), `RelationSchema`, `RelationTargetSchema`, `EnumDefSchema`,
   `EnumValueSchema`, `IndexDefSchema`, `CompositeUniqueSchema`, `JsonValueSchema`
   (recursive via `v.lazy`). Maps as `v.record(v.string(), …)`. Primitives only — no
   `Date`, `RegExp`, classes.
3. `packages/ir/src/types.ts` — `export type X = v.InferOutput<typeof XSchema>` for each
   schema above. No hand-written interface.
4. `packages/ir/src/version.ts` — `export const IR_VERSION = '1'` and
   `export function isCompatible(irVersion: string): boolean` (v1: strict equality).
5. `packages/ir/src/index.ts` — barrel re-exporting `schemas.ts`, `types.ts` and
   `version.ts` (drop the placeholder `version` const). Keep `"sideEffects": false` in
   `packages/ir/package.json`.
6. `packages/ir/src/version.test.ts` — `isCompatible` truth table.
7. `packages/ir/src/types.test-d.ts` (or a compile-only fixture) — representative literal
   `IR` / `SourceIR` values that must type-check, asserting the tagged-union `FieldType`
   narrows on `kind`; assert `v.InferOutput<typeof IrSchema>` is assignable to `IR`.
8. `bun run typecheck`, `bun run test`, `bun run build` green for the package.

## Dependencies

- [#6](6-package-skeletons.md)
