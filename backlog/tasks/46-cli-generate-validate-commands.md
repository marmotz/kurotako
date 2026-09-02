# backend — @kurotako/cli `tako generate` and `tako validate` commands

**Status**: to do
**Type**: backend
**Issue**: [#46](https://github.com/marmotz/kurotako/issues/46)

Reference: [../features/cli/technical.md §`tako generate`](../features/cli/technical.md#tako-generate-commandsgeneratets),
[§`tako validate`](../features/cli/technical.md#tako-validate-commandsvalidatets).

## Verified

- `@kurotako/config` [#25](25-config-load.md) exposes `loadConfig({ cwd?, configPath? })
  : Promise<LoadResult>` with `LoadResult = { config, configFile, rootDir }`.
- `@kurotako/core` [#21](21-core-run.md) exposes `run(config, { logger?, signal?, write? })
  : Promise<RunResult>` with `RunResult = { ir, order, files, artifacts }`; `write: false`
  skips the Writer **and** the `afterEmit` hook.
- The command tree, `sharedArgs`, `ConsoleReporter`, `renderError` and the top-level
  `TakoError` handler come from the cli scaffold task.
- Product decisions ([../features/cli/overview.md](../features/cli/overview.md)): minimal
  output, `--dry-run` on `generate`, `validate` = same checks up to (not including)
  emission.

## To do

1. `packages/cli/src/commands/generate.ts`:
   - internal helper `loadAndRun(opts: { cwd; configPath?; write: boolean; signal?; reporter })
     : Promise<RunResult>` = `loadConfig()` then `run(config, { logger: reporter, write,
     signal })`. Shared by `generate`, `validate` and (later) watch.
   - `defineCommand` args: `sharedArgs` + `watch: boolean` + `dryRun: boolean`.
   - no `--watch`: `const result = await loadAndRun({ ..., write: !dryRun })`; then
     - `write: true` → `reporter.info('wrote ' + result.files.length + ' files -> ' +
       relative(cwd, outputDir))` (derive `outputDir` from the resolved config);
     - `--dry-run` → `reporter.info('dry run: ' + result.files.length + ' files would be
       written')` (no file list — minimal).
   - `--watch` → `await watchAndRun({ cwd, configPath, reporter })` (module from the watch
     task; stub as `throw new Error('not implemented')` until then, or land this before
     the watch task).
2. `packages/cli/src/commands/validate.ts` — `defineCommand`, args `sharedArgs`:
   - `await loadAndRun({ ..., write: false })`;
   - success → `reporter.info('config and schema are valid')`;
   - any `TakoError` propagates → exit 1.
   - Does **not** shell out to `generate` — both call `loadAndRun`.
3. Register both commands in `cli.ts` (replace the stubs).
4. Tests (colocated vitest; fake `tako.config.ts` + fake in-memory driver modules via
   `jiti` on a temp dir, mirroring the config-system load tests):
   - `generate` happy path writes files, exits 0, summary line matches;
   - `--dry-run` writes nothing, prints "would be written", exits 0;
   - a driver that throws → exit 1, `renderError` output names the driver;
   - missing `tako.config.ts` → exit 1, `code: 'config_not_found'`;
   - `validate` on a valid project exits 0, writes nothing; on a config whose generator
     DAG has a cycle exits 1 with the cycle path, writes nothing.
5. `bun run typecheck` / `test` / `build` green.

## Dependencies

- [44-cli-scaffold-reporter-errors](44-cli-scaffold-reporter-errors.md)
- [25-config-load](25-config-load.md)
- [21-core-run](21-core-run.md)
