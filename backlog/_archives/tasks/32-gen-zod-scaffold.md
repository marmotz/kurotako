# backend — @kurotako/gen-zod scaffold, options, names and v3/v4 dialect

**Status**: done **Type**: backend **Issue**: [#32](https://github.com/marmotz/kurotako/issues/32)

Reference: [../features/generator-zod/technical.md §Package shape](../features/generator-zod/technical.md#package-shape),
[§Public contract (`generator.ts` + `options.ts`)](../features/generator-zod/technical.md#public-contract-generatorts--optionsts),
[§Naming (`names.ts`)](../features/generator-zod/technical.md#naming-namests--deterministic-never-namespace-prefixed).

## Verified

- `packages/gen-zod/src/index.ts` is the bootstrap placeholder
  ([#6](6-package-skeletons.md)); this feature rewrites it.
- The driver-facing shape is `TakoGenerator<O>` (object, optional Valibot `optionsSchema`,
  `generate(ctx, options)`); `@kurotako/config` curries `options` away
  ([config-system/technical.md](../features/config-system/technical.md)).
- Core exposes `Generator` / `GenerateContext` / `GenOutput` / `GeneratorArtifact` types
  ([core-pipeline/technical.md §Artifact manifest](../features/core-pipeline/technical.md#artifact-manifest-generatorartifact)).

## To do

1. `packages/gen-zod/package.json`: add `@kurotako/ir` (`workspace:*`) to `dependencies`,
   `@kurotako/core` + `@kurotako/config` (`workspace:*`) to `peerDependencies` +
   `devDependencies`, `valibot` to `dependencies`. `"sideEffects": false`.
2. `packages/gen-zod/tsconfig.json`: `references` to `../ir`, `../core`, `../config`.
3. `src/options.ts`: `ZodGeneratorOptions = v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) })`
   + inferred type.
4. `src/errors.ts`: `ZodGenError extends Error { code }` base + `ZodEnumCollisionError`
   (`code: 'zod_enum_collision'`, names both `EnumDef`s).
5. `src/names.ts`: pure helpers — `schemaName(entity, variant, family)`,
   `typeName(...)`, `enumConst(name)` / `enumSchemaName(name)` / `enumTypeName(name)`,
   `entityModule(ns, entity)` (`` `${ns}/zod/${entity}.schema` ``), `enumsModule(ns)`
   (`` `${ns}/zod/enums` ``), `filtersModule(ns)` (`` `${ns}/zod/filters` ``),
   `barrelModule(ns)` (`` `${ns}/zod` ``). The `zod/` sub-tree segment is the
   [output-modes](../features/output-modes/technical.md) amendment (one sub-tree per
   generator). `variant ∈ {'', 'Create', 'Update', 'Where', 'Select'}`,
   `family ∈ {'', 'Deep'}`; pattern `${Entity}${Variant}${Family}Schema`.
6. `src/dialect.ts`: `interface ZodDialect` with the leaf builders that differ between v3
   and v4 (`int()`, `uuid()`, `stringFormat(fmt)`, …); `dialectFor(version: 3 | 4):
   ZodDialect`. See the tables in
   [§Base scalar expression](../features/generator-zod/technical.md#base-scalar-expression-renderscalarsts-dialect-aware)
   and [§Constraints](../features/generator-zod/technical.md#constraints-renderconstraintsts-dialect-aware).
7. `src/generator.ts`: `zodGenerator: TakoGenerator<ZodGeneratorOptions>` skeleton
   (`name: 'zod'`, `optionsSchema`, `generate` returning an empty `GenOutput` for now).
8. `src/index.ts`: barrel — `zodGenerator`, `ZodGeneratorOptions`, `ZodArtifactExtra`
   (type placeholder), error classes.
9. `src/*.test.ts`: `names.ts` matrix (every variant × family), `dialect.ts` v3 vs v4
   leaves, `options.ts` default/validation.
10. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [6-package-skeletons](6-package-skeletons.md)
- [11-ir-types-and-version](11-ir-types-and-version.md)
- [15-core-types-and-contracts](15-core-types-and-contracts.md)
- [22-config-types-and-errors](22-config-types-and-errors.md)
