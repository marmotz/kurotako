# backend — namespace-filtered IR view

**Status**: done **Type**: backend **Issue**: [#18](https://github.com/marmotz/kurotako/issues/18)
Reference: [../features/core-pipeline/technical.md §Orchestration algorithm (`run.ts`)](../features/core-pipeline/technical.md#orchestration-algorithm-runts)
step 4.

## Verified

- Decided in the discussion: a generator receives an IR view filtered by namespace; the
  config may restrict a generator via `GeneratorConfig.namespaces`, default = all.
- [ir-model/technical.md](../features/ir-model/technical.md) already treats a relation
  whose `target.namespace` is absent from `ir.sources` as informational; v1 drivers
  ignore cross-source relations, so a filtered IR stays valid.

## To do

1. `packages/core/src/filter.ts`:
   - `filterIR(ir: IR, namespaces?: string[]): IR`.
   - `undefined` namespaces → deep clone of the whole IR.
   - otherwise → deep clone (`structuredClone`) keeping only the requested keys in
     `ir.sources`, preserving key order.
   - Relations targeting an excluded namespace are left untouched in the clone.
   - A name in `namespaces` that is not in `ir.sources` is ignored (config validity is
     config-system's job; `filterIR` stays total).
2. `packages/core/src/filter.test.ts`:
   - single-namespace restriction drops the other sources;
   - no restriction returns a full, independent clone (mutating the result does not touch
     the input);
   - a cross-namespace relation survives filtering;
   - an unknown namespace in the list is ignored.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
