# backend — run() orchestrator and afterEmit hook

**Status**: to do **Type**: backend **Issue**: [#21](https://github.com/marmotz/kurotako/issues/21)

Reference: [../features/core-pipeline/technical.md §Public API (`run.ts` + `types.ts`)](../features/core-pipeline/technical.md#public-api-runts--typests),
[§Orchestration algorithm (`run.ts`)](../features/core-pipeline/technical.md#orchestration-algorithm-runts),
[§Hooks (`Hooks`)](../features/core-pipeline/technical.md#hooks-hooks).

## Verified

- All the building blocks are separate tasks: merge, graph, filter, collect, writer.
  This task wires them into the single public entry point and adds the hook + result
  assembly.
- Decided: fail-fast; `opts.write === false` runs everything but skips the `Writer`
  (basis of `--dry-run` and `drift-guard`); `afterEmit` is the only v1 hook and fires
  only after a real write.
- **Root-barrel synthesis + banner (steps 5b/5c in
  [core-pipeline/technical.md](../features/core-pipeline/technical.md#orchestration-algorithm-runts))
  are NOT in this task.** [#48](48-output-root-barrel-and-banner.md) inserts
  `synthesizeRootBarrels` + `applyBanner` into `run.ts` between collect and write; #48
  depends on this task. Until #48 lands, two generators on one namespace collide on
  `<ns>/index.ts` — expected, and #48 is scheduled before the `gen-angular` integration
  ([#43](43-gen-angular-emit-artifact-run.md) depends on #48). This task ships `run.ts` as
  collect → write → `afterEmit` with no barrel step.

## To do

1. `packages/core/src/run.ts` — `export async function run(config: ResolvedConfig, opts?:
   RunOptions): Promise<RunResult>`:
   1. resolve `logger` (no-op default) and check `opts.signal` at each step boundary;
   2. **parse** each `config.sources` entry in sorted-namespace order, child logger tagged
      with the namespace, `ParseContext.cwd = config.rootDir`; a `parse()` throw →
      `DriverError { role: 'parser', name, namespace }`;
   3. **merge** via `mergeSources`;
   4. **order** via `generatorOrder`;
   5. **generate** each generator in order: `filterIR(ir, generatorConfig.namespaces)`,
      assemble `dependencies` from already-run declared deps (`dependsOn ∪
      optionalDependsOn`, present only), call `generate()`; a throw → `DriverError {
      role: 'generator', name }`; store `artifact`;
   6. **collect** via `mergeTrees`;
   7. **write** unless `opts.write === false`: `selectWriter(config.output).write(...)`;
   8. **afterEmit**: if the writer ran, `await config.hooks?.afterEmit({ outputDir, files,
      logger })` where `outputDir` is `output.dir` (mode A) / `output.packagesDir`
      (mode B) and `files` are written source paths; a throw → `HookError`;
   9. return `RunResult { ir, order, files, artifacts }` (`files` sorted).
2. Export `run` from `packages/core/src/index.ts`.
3. `packages/core/src/run.test.ts` — end to end with in-memory fake `Parser` /
   `Generator`:
   - `write: false` produces a full `RunResult` and touches no disk;
   - a real run writes the tree, then `afterEmit` fires once with the written paths;
   - a generator throw becomes a `DriverError` naming it;
   - `dependencies` passed to a generator holds only declared, present deps (hard dep
     always there, optional dep absent when not configured);
   - `order` matches the topological order;
   - `opts.signal` already aborted → rejects before parsing.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [15-core-types-and-contracts](15-core-types-and-contracts.md)
- [16-core-merge](16-core-merge.md)
- [17-core-graph](17-core-graph.md)
- [18-core-filter](18-core-filter.md)
- [19-core-collect](19-core-collect.md)
- [20-core-writer](20-core-writer.md)
