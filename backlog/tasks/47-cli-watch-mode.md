# backend — @kurotako/cli `tako generate --watch` (chokidar loop)

**Status**: to do
**Type**: backend
**Issue**: [#47](https://github.com/marmotz/kurotako/issues/47)

Reference: [../features/cli/technical.md §Watch mode](../features/cli/technical.md#watch-mode-watchts),
[§The `watchPaths` contract addition](../features/cli/technical.md#the-watchpaths-contract-addition).

## Verified

- `chokidar` (`^4`) is added as a dep by the cli scaffold task.
- `@kurotako/core` `run()` accepts `RunOptions.signal: AbortSignal` and checks it at every
  step boundary ([21-core-run](21-core-run.md), [15-core-types-and-contracts](15-core-types-and-contracts.md)).
- `Parser.watchPaths?(ctx: ParseContext): string[] | Promise<string[]>` is an optional
  member on the core contract ([15-core-types-and-contracts](15-core-types-and-contracts.md)),
  curried from `TakoParser.watchPaths?(ctx, options)` by `@kurotako/config`
  ([25-config-load](25-config-load.md)). A parser that omits it contributes nothing to the
  watch set beyond `tako.config.ts` (`parser-prisma` implements it —
  [26-prisma-parser-scaffold](26-prisma-parser-scaffold.md), not a hard dependency of
  this task).
- `loadAndRun` helper and the `generate --watch` flag come from the generate/validate task.
- Product decision ([../features/cli/overview.md](../features/cli/overview.md)): full
  regeneration on every change, no incremental.

## To do

1. `packages/cli/src/watch.ts` — `export async function watchAndRun(opts: { cwd; configPath?;
   reporter: ConsoleReporter }): Promise<never>`:
   - **initial cycle**: `await cycle()`; a failure is reported, not fatal (watch stays up).
   - **watch set**: after each successful `loadConfig`, compute `configFile` ∪
     `await sourceConfig.parser.watchPaths?.({ namespace, cwd: rootDir, logger })` for every
     source, resolved absolute against `rootDir`; diff against the current set and
     `watcher.add()` / `watcher.unwatch()` to reconcile. If `loadConfig` failed, watch
     only `configFile`.
   - **chokidar**: `chokidar.watch(paths, { ignoreInitial: true, awaitWriteFinish: {
     stabilityThreshold: 150, pollInterval: 20 } })`; `add`/`change`/`unlink` → one handler.
   - **debounce + supersede**: 100 ms trailing debounce; a new cycle aborts the in-flight
     one's `AbortController` and starts once it settles.
   - **`cycle()`**: `loadConfig` → `run(config, { logger: reporter, signal, write: true })`
     → summary line, or on `TakoError` `reporter.error(renderError(e))`; swallow the
     `AbortError` of a superseded run; never rethrow.
   - **separators**: `--- rebuild (<file> changed) ---` per cycle, `watching N paths` after
     setup.
   - **shutdown**: `SIGINT` / `SIGTERM` → `await watcher.close()`, flush reporter, exit 0.
2. Wire `watchAndRun` into `commands/generate.ts` (replace the stub) when `--watch` is set.
3. Tests (colocated vitest, fake timers + temp dir):
   - initial cycle runs once; touching a watched schema file triggers exactly one rebuild
     after the debounce;
   - a burst of N events → one rebuild;
   - a change mid-run aborts the previous `run()` (assert the passed `signal` fired) then
     runs again;
   - `loadConfig` failure keeps the watcher alive watching `tako.config.ts`; fixing the
     file recovers;
   - editing the config to add a source extends the watch set; removing it shrinks it;
   - `SIGINT` closes the watcher and exits 0.
4. `bun run typecheck` / `test` / `build` green.

## Dependencies

- [46-cli-generate-validate-commands](46-cli-generate-validate-commands.md)
- [25-config-load](25-config-load.md)
- [21-core-run](21-core-run.md)
