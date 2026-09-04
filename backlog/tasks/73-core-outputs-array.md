# backend — core `outputs[]`: types and per-output write loop

**Status**: done
**Type**: backend
**Issue**: [#73](https://github.com/marmotz/kurotako/issues/73)

Reference: [../features/output-modes/technical.md §Multiple outputs (`outputs[]`)](../features/output-modes/technical.md#multiple-outputs-outputs),
[§`run.ts` amendments](../features/output-modes/technical.md#runts-amendments).

## Verified

- `packages/core/src/types.ts` currently declares `ResolvedConfig.output: OutputConfig`
  (singular), `OutputConfig` without a `generators` field, and `RunResult` without a
  `written` field.
- `packages/core/src/run.ts` step 5/5b/5c compute one global collision-checked tree, one
  global synthesized root-barrel set (`synthesizeRootBarrels`) and one global
  banner-applied tree — unaffected by this task, kept as-is (technical.md: "This step 5b
  run … is not itself looped per output"). Step 6 currently calls `selectWriter(config.output)`
  once; step 7 calls `config.hooks?.afterEmit` once, with `outputDir` derived from
  `config.output.mode`.
- `packages/core/src/run.test.ts` and `run.package.test.ts` build a `ResolvedConfig` by
  hand with `output: { dir }` / `output: { mode: 'package', ... }` — both need updating to
  `outputs: [{ ... }]`.
- `synthesizeRootBarrels(files, artifactsByGenerator?, logger?)`
  (`packages/core/src/writer/barrel.ts`) and `mergeTrees(perGenerator, opts?)`
  (`packages/core/src/collect.ts`) are reused as-is by the new per-output loop — no
  signature change needed, both already generic over an arbitrary file subset.
- `selectWriter(output: OutputConfig): Writer` (`packages/core/src/writer/index.ts`) and
  `Writer.write(input: WriteInput)` (`packages/core/src/writer/types.ts`) already take one
  `OutputConfig` / one file tree per call — no change needed, the plurality is entirely a
  `run.ts`-level loop.

## To do

1. `packages/core/src/types.ts`:
   - `OutputConfig` gains `generators?: string[]` — restricts this destination to a
     subset of `config.generators` by name; `undefined` = every generator that ran.
   - `ResolvedConfig.output: OutputConfig` → `ResolvedConfig.outputs: OutputConfig[]`.
   - `RunResult` gains `written: { output: OutputConfig; files: string[] }[]` — one entry
     per `config.outputs[]`, `[]` when `write: false`. `RunResult.files` /
     `RunResult.artifacts` keep their current meaning (the full computed tree/artifacts,
     every generator, independent of any output's `generators` filter).
2. `packages/core/src/run.ts`:
   - Keep steps 1–5c exactly as they are today (parse, merge, order, generate, collect,
     global barrel synthesis, banner) — this remains the single, unfiltered computation
     feeding `RunResult.files` / `RunResult.artifacts`.
   - Replace step 6 with a loop over `config.outputs`. For each `o`:
     1. `names = new Set(o.generators ?? order)`.
     2. Filter the step-5 collision-checked tree (`collected`, pre-barrel, pre-banner) to
        the entries whose path's second segment (`<ns>/<generatorName>/…`) is in `names`.
     3. `synthesizeRootBarrels(filteredFiles, artifacts, logger)` on that subset (pass the
        full `artifacts` map — both `synthesizeRootBarrels` and `collectPeerDependencies`
        derive their contributor set from `files`, not from the map's keys).
     4. `mergeTrees([{ generator: '<filtered>', files: filteredFiles }, { generator:
        '<synthesized root barrel>', files: outputBarrels }])`, then `applyBanner(...)`.
     5. `selectWriter(o).write({ files: outputTree, output: o, artifacts, logger })`.
     6. Push `{ output: o, files: writtenPaths }` onto `RunResult.written`.
   - Replace step 7 with: for each entry just pushed to `written` (same `config.outputs`
     order), call `config.hooks?.afterEmit?.({ outputDir, files, logger })` where
     `outputDir` is `o.dir` (mode A) / `o.packagesDir` (mode B) for that output, falling
     back to `config.rootDir`. Keep wrapping a throw as `HookError('afterEmit', { cause })`.
     A `HookError` stops the loop — later outputs in `config.outputs` are not written
     (consistent with `run()` being "sequential, fail-fast").
   - `opts.write === false` skips the whole loop: `RunResult.written = []`, no writer or
     hook call, as today.
3. Update `packages/core/src/run.test.ts` and `run.package.test.ts` fixtures: `output: {
   dir }` → `outputs: [{ dir }]`, `output: { mode: 'package', ... }` →
   `outputs: [{ mode: 'package', ... }]`.
4. New tests in `run.test.ts` (and `run.package.test.ts` for the mode-B half):
   - two outputs with disjoint `generators` filters (e.g. `['zod']` and `['zod',
     'angular']`) → each destination's written files match its filter, each root barrel
     lists only its own destination's generators;
   - `RunResult.written` has one entry per `config.outputs`, in order;
   - `RunResult.files` / `RunResult.artifacts` still cover every generator regardless of
     any output's filtering;
   - an output with `generators` omitted gets every generator that ran;
   - one mode-A output + one mode-B output in the same run, both written correctly;
   - `afterEmit` called once per output, in `config.outputs` order, each call's
     `outputDir`/`files` matching that output only;
   - a `HookError` thrown for output 1 of 2 stops output 2 from being written;
   - `write: false` → `RunResult.written` is `[]`, nothing touches disk.
5. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/core`.

## Dependencies

None.
