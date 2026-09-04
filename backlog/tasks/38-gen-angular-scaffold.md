# backend — @kurotako/gen-angular scaffold, options, names and Zod-artifact reader

**Status**: done **Type**: backend **Issue**: [#38](https://github.com/marmotz/kurotako/issues/38)

Reference: [../features/generator-angular/technical.md §Package shape](../features/generator-angular/technical.md#package-shape),
[§Public contract (`generator.ts` + `options.ts`)](../features/generator-angular/technical.md#public-contract-generatorts--optionsts),
[§Naming (`names.ts`)](../features/generator-angular/technical.md#naming-namests--deterministic-never-namespace-prefixed),
[§File layout](../features/generator-angular/technical.md#file-layout-per-namespace-ns).

## Verified

- `packages/gen-angular/src/index.ts` is the bootstrap placeholder
  ([#6](6-package-skeletons.md)); this feature rewrites it.
- The driver-facing shape is `TakoGenerator<O>` with `name`, `dependsOn?`,
  `optionalDependsOn?`, optional Valibot `optionsSchema`, `generate(ctx, options)`;
  `@kurotako/config` curries `options` away
  ([config-system/technical.md](../features/config-system/technical.md)).
- Core exposes `Generator` / `GenerateContext` (`{ ir, dependencies, logger }`) /
  `GenOutput` / `GeneratorArtifact` / `EntitySymbols` types; the topological order + hard
  `dependsOn` presence check guarantee `ctx.dependencies.zod` is present
  ([core-pipeline/technical.md §Artifact manifest](../features/core-pipeline/technical.md#artifact-manifest-generatorartifact)).
- `@kurotako/gen-zod` re-exports `ZodArtifactExtra` from its barrel
  ([32-gen-zod-scaffold](32-gen-zod-scaffold.md)).

## To do

1. `packages/gen-angular/package.json`: `@kurotako/ir` (`workspace:*`) in `dependencies`;
   `@kurotako/core` + `@kurotako/config` + `@kurotako/gen-zod` (`workspace:*`) in
   `peerDependencies` + `devDependencies`; `valibot` in `dependencies`.
   `"sideEffects": false`. No `@angular/*`, no `zod`.
2. `packages/gen-angular/tsconfig.json`: `references` to `../ir`, `../core`, `../config`,
   `../gen-zod`.
3. `src/options.ts`: `AngularGeneratorOptions = v.object({ forms:
   v.optional(v.array(v.picklist(['reactive', 'signal'])), ['reactive', 'signal']),
   relations: v.optional(v.picklist(['flat', 'deep']), 'flat') })` + inferred type.
4. `src/errors.ts`: `AngularGenError extends Error { code }` base (+ any specific case
   needed, e.g. a missing-Zod-symbol guard `code: 'angular_missing_zod_symbol'`).
5. `src/names.ts`: pure helpers — `controlsTypeName(entity, variant, family)`,
   `formTypeName(...)`, `factoryName(entity)` (`` `${Entity}FormFactory` ``),
   `factoryMethod(variant)` (`createCreateForm` / `createUpdateForm`),
   `signalSchemaName(entity, variant)` (`` `${entity}CreateFormSchema` ``, camelCase),
   `modelFactoryName(entity, variant)` (`` `create${Entity}CreateModel` ``),
   `entityModule(ns, entity)` (`` `${ns}/angular/${entity}.form` ``), `runtimeModule(ns)`
   (`` `${ns}/angular/zod-forms.runtime` ``), `barrelModule(ns)` (`` `${ns}/angular` ``).
   The `angular/` sub-tree segment is the
   [output-modes](../features/output-modes/technical.md) amendment (one sub-tree per
   generator). `variant ∈ {'Create', 'Update'}`, `family ∈ {'', 'Deep'}`.
6. `src/zod-artifact.ts`: a typed reader over `ctx.dependencies.zod` — given
   `${ns}.${entity}`, return `{ module, symbols }` and resolve a role
   (`createSchema` / `createType` / `updateSchema` / `updateType` / `createDeepSchema` /
   …) to an identifier, plus `extra.perNamespace[ns]` (`barrelModule`, `enums`). Throws
   `AngularGenError` when a required role is absent.
7. `src/generator.ts`: `angularGenerator: TakoGenerator<AngularGeneratorOptions>` skeleton
   — `name: 'angular'`, `dependsOn: ['zod']`, `optionsSchema`, `generate` returning an
   empty `GenOutput` for now.
8. `src/index.ts`: barrel — `angularGenerator`, `AngularGeneratorOptions`,
   `AngularArtifactExtra` (type placeholder), error classes.
9. `src/*.test.ts`: `names.ts` matrix (variant × family), `options.ts` default/validation,
   `zod-artifact.ts` against a hand-built fake `GeneratorArtifact` (role resolution +
   missing-role throw).
10. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [6-package-skeletons](6-package-skeletons.md)
- [11-ir-types-and-version](11-ir-types-and-version.md)
- [15-core-types-and-contracts](15-core-types-and-contracts.md)
- [22-config-types-and-errors](22-config-types-and-errors.md)
- [32-gen-zod-scaffold](32-gen-zod-scaffold.md)
