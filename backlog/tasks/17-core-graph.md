# backend — generator dependency graph and topological order

**Status**: to do **Type**: backend **Issue**: [#17](https://github.com/marmotz/kurotako/issues/17)
Reference: [../features/core-pipeline/technical.md §Orchestration algorithm (`run.ts`)](../features/core-pipeline/technical.md#orchestration-algorithm-runts)
step 3, and [ADR-0002](https://github.com/marmotz/kurotako/blob/main/docs/adr/0002-no-middle-generators-dag.md).

## Verified

- Decided ([ADR-0002](https://github.com/marmotz/kurotako/blob/main/docs/adr/0002-no-middle-generators-dag.md)):
  `dependsOn` is a hard dependency (absent from config → error), `optionalDependsOn` is
  soft (absent → ignored). Both constrain order.

## To do

1. `packages/core/src/graph.ts`:
   - `generatorOrder(generators: Record<string, GeneratorConfig>): string[]`.
   - Nodes = generator short names present in the config. Edges from `dependsOn` +
     `optionalDependsOn`.
   - A `dependsOn` name not in the config → `UnknownDependencyError { generator, missing }`.
   - An `optionalDependsOn` name not in the config → drop the edge, no error.
   - A name appearing in both arrays of one generator → `UnknownDependencyError` /
     dedicated validation error (config bug).
   - Kahn's algorithm; ties broken by config declaration order.
   - Non-empty residual set → `DependencyCycleError` carrying the cycle path.
2. `packages/core/src/graph.test.ts`: linear chain, diamond, `optionalDependsOn`
   present vs absent, missing hard dep, 2- and 3-node cycles, tie-break follows config
   order, empty config → `[]`.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
