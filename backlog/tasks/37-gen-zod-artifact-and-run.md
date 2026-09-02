# backend — @kurotako/gen-zod artifact assembly and generate() wiring

**Status**: to do **Type**: backend **Issue**: [#37](https://github.com/marmotz/kurotako/issues/37)

Reference: [../features/generator-zod/technical.md §Artifact (`artifact.ts`) — the shape the overview deferred here](../features/generator-zod/technical.md#artifact-artifactts--the-shape-the-overview-deferred-here),
[§Public contract (`generator.ts` + `options.ts`)](../features/generator-zod/technical.md#public-contract-generatorts--optionsts),
[§Tests (vitest, colocated)](../features/generator-zod/technical.md#tests-vitest-colocated).

## Verified

- `GeneratorArtifact = { entities: Record<string, EntitySymbols>; peerDependencies?:
  Record<string, string>; extra?: unknown }`,
  `EntitySymbols = { module: string; symbols: Record<string, string> }`, key
  `${namespace}.${entity}`; `extra` stays `unknown` at the core boundary
  ([core-pipeline/technical.md §Artifact manifest](../features/core-pipeline/technical.md#artifact-manifest-generatorartifact)).
- Emitted paths use the `<ns>/zod/` sub-tree prefix
  ([output-modes](../features/output-modes/technical.md) amendment).
- `GenerateContext` = `{ ir, dependencies, logger }`, `ir` already namespace-filtered.
- `generate` must be synchronous and pure (drift-guard).

## To do

1. `packages/gen-zod/src/artifact.ts`:
   - `buildArtifact(ir, opts): GeneratorArtifact` — `entities[`${ns}.${entity}`] = { module:
     entityModule(ns, entity), symbols: <full names.ts role matrix> }`;
     `peerDependencies: { zod: opts.zodVersion === 4 ? '^4' : '^3' }`.
   - `export interface ZodArtifactExtra { zodVersion; families; variants; perNamespace:
     Record<string, { enumsModule; filtersModule; barrelModule; enums: Record<string,
     { constName; schemaName; typeName; module }> }> }`; attach as `artifact.extra`.
2. `packages/gen-zod/src/generator.ts`: implement `generate(ctx, options)` —
   `dialectFor(options.zodVersion)`, iterate `ctx.ir.sources` in key order, per source emit
   `enums.ts` + `filters.ts` + one file per entity + `index.ts` (all `<ns>/zod/`-prefixed),
   collect into `files`, call `buildArtifact`. Return `{ files, artifact }`.
3. Finalise `src/index.ts` barrel: export `ZodArtifactExtra`.
4. `packages/gen-zod/src/*.test.ts` (end-to-end, fixture IR):
   - artifact `entities` keys / `module` (`<ns>/zod/<entity>.schema`) / every role in
     `symbols`; `peerDependencies.zod` matches `zodVersion`; `extra.zodVersion` echoes the
     option; `extra.perNamespace` lists `<ns>/zod/{enums,filters}` + `<ns>/zod` barrel;
   - `zodVersion: 3` vs `4` produce the expected builder differences end to end;
   - cross-source relation degrades to FK id + `debug`;
   - **determinism**: same IR + options → deep-equal `GenOutput` on a second call; entity /
     field order preserved.
5. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [36-gen-zod-emit-entity-barrel](36-gen-zod-emit-entity-barrel.md)
