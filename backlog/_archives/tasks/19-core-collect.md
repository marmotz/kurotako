# backend — virtual tree aggregation and collision detection

**Status**: done **Type**: backend **Issue**: [#19](https://github.com/marmotz/kurotako/issues/19)

Reference: [../features/core-pipeline/technical.md §Orchestration algorithm (`run.ts`)](../features/core-pipeline/technical.md#orchestration-algorithm-runts)
step 5, and [§Determinism](../features/core-pipeline/technical.md#determinism).

## Verified

- Decided in the discussion: generators return a virtual file tree; the core aggregates
  every generator's tree, rejects path collisions between generators, then writes once.
- `VirtualFile.path` is POSIX, relative to the output root; the generator owns the
  `<namespace>/<generatorName>/` prefix (one sub-tree per generator —
  [output-modes/technical.md](../features/output-modes/technical.md)). The synthesized
  `<namespace>/index.ts` barrel and the `applyBanner` pass are separate `run.ts` steps
  (5b / 5c) added by output-modes; `mergeTrees` itself only aggregates + detects
  collisions.

## To do

1. `packages/core/src/collect.ts`:
   - `mergeTrees(perGenerator: { generator: string; files: VirtualFile[] }[]): VirtualFile[]`.
   - Normalize each `path`: POSIX separators, collapse `.`/`..`, reject a path that
     escapes the root or is absolute → `InvalidOutputPathError { path, generator }`.
   - Same normalized `path` from two generators → `OutputCollisionError { path,
     generators: [a, b] }`.
   - Return the union sorted by `path`.
2. `packages/core/src/collect.test.ts`: collision between two generators; escaping path
   (`../x`, `/x`); output sorted by path; single generator passthrough.
3. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
