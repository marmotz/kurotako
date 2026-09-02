# backend — @kurotako/core Writer.plan() + run({ plan: true })

**Status**: to do
**Type**: backend
**Issue**: [#51](https://github.com/marmotz/kurotako/issues/51)

Reference: [../features/drift-guard/technical.md §Mechanism — the `Writer.plan()` seam](../features/drift-guard/technical.md#mechanism--the-writerplan-seam),
[§`run()` amendment](../features/drift-guard/technical.md#run-amendment-core-runts--typests-tasks-15-21).

## Verified

- [#20](20-core-writer.md) creates `packages/core/src/writer/` with `types.ts` (`Writer`,
  `WriteInput`), `directory.ts` (`directoryWriter` — unconditional wipe + `mkdir -p` +
  `writeFile` + `<dir>/.gitattributes`, returns absolute paths) and `index.ts`
  (`selectWriter(output)`).
- [#21](21-core-run.md) wires `run.ts` steps 1–8 with `RunOptions { logger?, signal?,
  write? }` / `RunResult { ir, order, files, artifacts }`; step 5c `applyBanner(files)`
  runs immediately before `selectWriter(...).write(...)`; step 7 fires `afterEmit` only
  when the writer ran.
- [#48](48-output-root-barrel-and-banner.md) is folded into #20/#21 already; barrels +
  banner are applied to `files` before the writer call.
- `PlannedFile` does not exist yet. `RunResult.files` is the mode-A-shaped virtual tree
  (`<ns>/<generatorName>/…`), not the on-disk layout (mode B remaps into
  `<pkgDir>/src/…` + synthesized manifest).

## To do

1. `packages/core/src/writer/types.ts`:
   - `export interface PlannedFile { path: string /* absolute */; content: string }`.
   - `Writer` gains `plan(input: WriteInput): Promise<PlannedFile[]>` — same layout as
     `write()`, **no disk I/O**, `content` is the exact bytes `write()` would serialise
     (banner already applied by the caller, as for `write`).
2. `packages/core/src/writer/directory.ts` — refactor `directoryWriter` so the layout is
   computed once:
   - `plan({ files, output })`: map each `VirtualFile` to
     `{ path: resolve(output.dir, vf.path), content: vf.content }`, append
     `{ path: resolve(output.dir, '.gitattributes'), content: GITATTRIBUTES }`. Sorted by
     `path`. No `rm`, no `mkdir`, no `writeFile`.
   - `write({ files, output })`: `const planned = await this.plan({ files, output })`, then
     the existing behaviour — resolve + **unconditional wipe** (`fs.rm(dir, { recursive:
     true, force: true })`) + recreate + `mkdir -p` parent + `writeFile` utf-8 over
     `planned` in sorted order; return `planned.map(p => p.path)`.
3. `packages/core/src/types.ts`:
   - `RunOptions` gains `plan?: boolean` (default `false`).
   - `RunResult` gains `plan?: PlannedFile[]` (present iff `opts.plan === true`).
   - Re-export `PlannedFile` from the barrel (`index.ts`).
4. `packages/core/src/run.ts` — when `opts.plan` is `true`:
   - run steps 1 → 5c unchanged (parse, merge, `assertIR`, generator DAG, collect,
     synthesize root barrels, `applyBanner`);
   - force `write` off; call `result.plan = await selectWriter(config.output).plan({
     files, output: config.output })` instead of `.write(...)`;
   - **do not** fire the `afterEmit` hook;
   - still return `{ ir, order, files, artifacts, plan }`.
   `opts.plan` and `opts.write !== false` together → `plan` wins (no write), documented in
   the `RunOptions` doc comment.
5. `packages/core/src/writer/index.ts` — `packageWriter` (mode B) does not implement
   `plan()` yet; `selectWriter` for `mode: 'package'` still returns it. Add a short
   `// plan() added by 52-output-package-writer-plan` note. A `run({ plan: true })` in
   mode B throws `TypeError` until that task lands — acceptable (drift-guard mode B is
   task 2/3 of this feature).
6. Tests (colocated vitest):
   - `directory.test.ts`: `plan()` returns absolute paths under `output.dir` +
     `.gitattributes`, content byte-identical to what `write()` writes, and `plan()`
     touches no disk (spy on `fs`); `write()` still wipes a pre-existing non-emitted file.
   - `run.test.ts`: `run(config, { plan: true })` with fake in-memory drivers →
     `RunResult.plan` populated, `afterEmit` never called, nothing written to a temp dir;
     an invalid IR still throws the same `IrValidationError`.
7. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [20-core-writer](20-core-writer.md)
- [21-core-run](21-core-run.md)
