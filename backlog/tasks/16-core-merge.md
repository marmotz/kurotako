# backend — SourceIR merge into the global IR

**Status**: done **Type**: backend **Issue**: [#16](https://github.com/marmotz/kurotako/issues/16)
Reference: [../features/core-pipeline/technical.md §Orchestration algorithm (`run.ts`)](../features/core-pipeline/technical.md#orchestration-algorithm-runts)
steps 1-2, and [§What stays out of this feature](../features/core-pipeline/technical.md#what-stays-out-of-this-feature).

## Verified

- [ir-model/technical.md §Out of scope here](../features/ir-model/technical.md) explicitly
  leaves `mergeIR` and the duplicate-namespace policy to this package; `@kurotako/ir`
  provides `validateSourceIR`, `assertIR`, `IR_VERSION`, `isCompatible`.

## To do

1. `packages/core/src/merge.ts`:
   - `mergeSources(entries: { namespace: string; sourceIR: SourceIR }[]): IR`.
   - Reject `sourceIR.namespace !== namespace` with `NamespaceMismatchError`.
   - Run `validateSourceIR` per source; wrap issues in `IrValidationError` tagged with the
     namespace.
   - Build `{ irVersion: IR_VERSION, sources }`, inserting each `SourceIR` under its
     namespace; a duplicate key throws `DuplicateNamespaceError`.
   - Run `assertIR(ir)` (full cross-source validation + `isCompatible`); wrap failure in
     `IrValidationError`.
2. `packages/core/src/merge.test.ts`:
   - two sources merge into `{ irVersion, sources: { a, b } }`;
   - mismatched namespace rejects;
   - a `validateSourceIR` failure surfaces tagged with its namespace;
   - a post-merge cross-source relation coherence failure surfaces as `IrValidationError`;
   - key order in `ir.sources` follows the input order (determinism).
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
- [#12](12-ir-runtime-validation.md)
