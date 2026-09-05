# `tako` CLI (`@kurotako/cli`) — technical design

Design for `@kurotako/cli`. Product decisions come from [overview.md](overview.md); the
primitives this feature builds on live in
[core-pipeline/technical.md](../core-pipeline/technical.md) (`run()`, `RunResult`,
`RunOptions`, `Logger`, the `TakoError` hierarchy) and
[config-system/technical.md](../config-system/technical.md) (`loadConfig()`,
`LoadResult`, `CONFIG_TEMPLATE`, the `ConfigError` hierarchy). This document turns the
overview into a concrete command surface, a watch loop, and a reporter.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md)
  scaffolds `packages/cli/` with `src/index.ts` (a `version` const + trivial test) and,
  specifically for this package, `src/bin/tako.ts` (shebang `#!/usr/bin/env node`),
  `"bin": { "tako": "./dist/bin/tako.js" }`, and a working `--version`
  ([task 6](../../tasks/6-package-skeletons.md) step 3;
  [monorepo-bootstrap/technical.md §Package `package.json`](../monorepo-bootstrap/technical.md#package-packagejson-dual-esm--cjs)).
  This feature replaces the placeholder with the real command tree.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup (the bin keeps **ESM only**; the
  library entry stays dual), vitest, Biome. Node >= 24. **No `Bun.*` API** — the bin is
  smoke-run under both Node and Bun in CI
  ([monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md), CI step
  `node …/tako.js --version` / `bun …/tako.js --version`).
- Upstream contracts already designed and consumed as-is:
  - [`@kurotako/config`](../config-system/technical.md) — `loadConfig({ cwd?, configPath? })
    : Promise<LoadResult>` where `LoadResult = { config: ResolvedConfig; configFile: string;
    rootDir: string }`; `CONFIG_TEMPLATE: string`; `ConfigError` classes all extend
    `TakoError`.
  - [`@kurotako/core`](../core-pipeline/technical.md) — `run(config, { logger?, signal?,
    write? }): Promise<RunResult>` where `RunResult = { ir; order; files: VirtualFile[];
    artifacts }`; `Logger` interface; `TakoError { code }` base.
- Relevant design decisions (see [docs/vision.md](../../../docs/vision.md) and
  [docs/architecture.md](../../../docs/architecture.md)): `tako` binary, `@kurotako/*`
  scope; mode B is rejected by `run()` in v1 — the CLI surfaces that error, nothing more.

## Package

```
packages/cli/src/
  index.ts          # library barrel: re-export runCli() + the reporter types (programmatic use)
  bin/tako.ts       # shebang entry; imports runCli() and calls it with process.argv
  cli.ts            # runCli(): builds the citty command tree, maps errors, sets exit code
  commands/
    init.ts         # `tako init`
    generate.ts     # `tako generate` (+ --watch, --dry-run)
    validate.ts     # `tako validate`
  reporter.ts       # ConsoleReporter: implements @kurotako/core Logger + phase/summary output
  watch.ts          # watchAndRun(): chokidar loop around loadConfig() + run()
  errors.ts         # renderError(): TakoError -> formatted string; exit-code mapping
  *.test.ts         # colocated vitest suites
```

Runtime dependencies:

| Dep | Why |
|---|---|
| `@kurotako/config` (`workspace:*`) | `loadConfig()`, `CONFIG_TEMPLATE`, `ConfigError` types |
| `@kurotako/core` (`workspace:*`) | `run()`, `RunResult` / `RunOptions` types, `Logger`, `TakoError` **value** (single `instanceof` catch) |
| `citty` | command tree, arg parsing, auto `--help` / `--version` (decided) |
| `chokidar` (`^4`) | file watching for `--watch` (decided) |

`tsconfig.json` `references`: `[{ "path": "../config" }, { "path": "../core" }]`
(`@kurotako/cli` imports `@kurotako/ir` types only transitively; no direct reference).
`"sideEffects": false` on the library entry; the bin is an executable, not tree-shaken.

**Dependency direction**: `cli -> config -> core -> ir`. `cli -> core` directly too
(for `run()` and `TakoError`); still acyclic.

### Why citty (alternatives considered)

- **citty** (UnJS). Retained: tiny, typed `defineCommand` tree, lazy sub-command
  loading, built-in `--help` / `--version`, zero transitive bloat. Same ecosystem as
  `jiti` (already the config loader in [config-system](../config-system/technical.md)) and
  `chokidar` is framework-agnostic — the toolchain stays coherent.
- **clipanion** (Yarn). Rejected: class-per-command, heavier, its strengths (very large
  command sets, token-level validation) are not needed for four commands.
- **commander**. Rejected: the most common choice but weaker TS inference, no lazy
  loading, and no ecosystem affinity here.
- **Hand-rolled `parseArgs`** (`node:util`). Rejected: `--help` / sub-command
  formatting / error UX would all be re-implemented; not worth it past two commands.

## Command surface (`cli.ts`)

```
tako                       # prints help
tako --version | -v        # package version (from package.json, injected at build by tsup `define` or read at runtime)
tako --help  | -h          # citty-generated
tako init    [--config <path>] [--force]
tako generate [--config <path>] [--watch] [--dry-run]
tako validate [--config <path>]
tako check    [--config <path>]   # drift guard — see features/drift-guard/technical.md
```

### Global option

- `--config <path>` — forwarded verbatim to `loadConfig({ cwd: process.cwd(), configPath })`.
  Declared on each command (citty has no first-class global-option slot; a shared
  `sharedArgs` object is spread into every command's `args`).

### `tako init` (`commands/init.ts`)

1. `target = resolve(process.cwd(), 'tako.config.ts')` — `init` always writes into the
   **current directory**, it does not walk up (unlike `loadConfig`'s resolution). `--config
   <path>` overrides the target path.
2. If `target` exists and `--force` is absent → `ConfigExistsError` (`config_exists`,
   defined in **this** package's `errors.ts`, extends `TakoError`), exit 1. The overview
   says "refuses to overwrite"; `--force` is the explicit escape hatch (not in the
   config-system overview but harmless and expected of an `init`).
3. Write `CONFIG_TEMPLATE` (from `@kurotako/config`) utf-8, `mkdir -p` the parent.
4. `reporter.info("created tako.config.ts")`, exit 0.

No prompts, no schema auto-detection ([config-system/overview.md §`tako init`](../config-system/overview.md)).

### `tako generate` (`commands/generate.ts`)

Single run (no `--watch`):

1. `const { config, configFile, rootDir } = await loadConfig({ cwd: process.cwd(), configPath })`.
2. `const result = await run(config, { logger: reporter, write: !dryRun })`.
3. Report (see [Reporter](#reporter-reporterts)):
   - non-watch, `write: true` → the writer already ran; print the summary
     (`written N files in <relative output dir>`).
   - `--dry-run` → `run()` was called with `write: false`; print
     `dry run: N files would be written` and, since output is *minimal*, **not** the file
     list (a `--verbose` file listing is an explicit non-goal for v1 — overview).
4. exit 0.

Any `TakoError` thrown by `loadConfig` or `run` propagates to `cli.ts`'s top-level
handler (below). Fail-fast — the first error stops the command
([core-pipeline/overview.md](../core-pipeline/overview.md)).

`--watch` → delegates to `watchAndRun()` (next section) and never returns until the
process is signalled.

### `tako validate` (`commands/validate.ts`)

"Same checks as `generate` up to (not including) emission" ([overview.md](overview.md)):

1. `loadConfig(...)` — config resolution + structural + cross-field + per-driver options
   validation (all in `@kurotako/config`).
2. `run(config, { logger: reporter, write: false })` — exercises parse, merge + `assertIR`,
   the generator DAG, every `generate()` and the collision/path checks, and stops before
   the `Writer` (`write: false` also skips the `afterEmit` hook —
   [core-pipeline/technical.md step 6–7](../core-pipeline/technical.md)).
3. Success → `reporter.info("config and schema are valid")`, exit 0.
4. Any `TakoError` → top-level handler, exit 1.

`validate` is exactly `generate --dry-run` minus the "would be written" line; it is kept
as a separate verb because that is the CI-facing intent and the exit code is the whole
point. It is **not** implemented by shelling out to `generate` — both call the same
internal `loadAndRun({ write })` helper in `generate.ts`.

## Watch mode (`watch.ts`)

`tako generate --watch`. Full regeneration on every change — no incremental
([overview.md](overview.md), consistent with
[core-pipeline/overview.md §Execution model](../core-pipeline/overview.md)).

```ts
export async function watchAndRun(opts: {
  cwd: string
  configPath?: string
  reporter: ConsoleReporter
}): Promise<never>
```

Algorithm:

1. **Initial run.** `await cycle()` (below). A failure here is reported but does **not**
   exit — watch mode stays up so the user can fix and save (overview: "reports the error
   and keeps watching").
2. **Resolve the watch set.** After each *successful* `loadConfig`, compute:
   - `configFile` (always watched);
   - for every `[ns, sourceConfig]` in `config.sources`:
     `await sourceConfig.parser.watchPaths?.({ namespace: ns, cwd: rootDir, logger })`
     — see [the `watchPaths` contract addition](#the-watchpaths-contract-addition). Paths
     are resolved absolute against `rootDir`.
   The union is diffed against the currently watched set; chokidar `add()` / `unwatch()`
   reconcile it (a config edit can add or drop a source, so the set is recomputed every
   cycle).
   If `loadConfig` itself failed, keep watching **only** `configFile` (the only file we
   can be sure matters) until it loads again.
3. **chokidar.** `chokidar.watch(paths, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 20 } })`.
   `add` / `change` / `unlink` events all funnel into one handler.
4. **Debounce + supersede.** A 100 ms trailing debounce coalesces bursts. When a new
   cycle starts while one is running, the in-flight cycle's `AbortController` is aborted
   (`run()` accepts `RunOptions.signal` and checks it at every step boundary —
   [core-pipeline/technical.md §Orchestration algorithm](../core-pipeline/technical.md))
   and the new cycle starts once the old one settles.
5. **`cycle()`**: `loadConfig` → `run(config, { logger: reporter, signal, write: true })`
   → report summary or, on `TakoError`, `reporter.error(renderError(e))`. An `AbortError`
   from a superseded run is swallowed. Never rethrows.
6. **Shutdown.** `SIGINT` / `SIGTERM` → `await watcher.close()`, flush the reporter, exit
   0. The return type is `never` because the normal path is process termination.

### The `watchPaths` contract addition

The CLI needs the list of schema files behind each source without knowing any parser's
option shape. Chosen mechanism (see [overview.md open questions](overview.md)): an
**optional method on the driver contract**, curried exactly like `parse`.

- [`@kurotako/config`](../config-system/technical.md) — `TakoParser<O>` gains:
  ```ts
  watchPaths?(ctx: ParseContext, options: O): string[] | Promise<string[]>
  ```
  `load.ts` curries the `options` argument away alongside `parse`, so the core `Parser`
  exposes `watchPaths?(ctx: ParseContext): string[] | Promise<string[]>`.
- [`@kurotako/core`](../core-pipeline/technical.md) — `Parser` gains the optional
  `watchPaths?(ctx: ParseContext)` member. **`run()` never calls it** — it is metadata for
  watchers (`cli`, later `drift-guard`). Pure type addition, no behaviour change.
- [`parser-prisma`](../parser-prisma/technical.md) — `prismaParser` implements it,
  returning the resolved `schema.prisma` file(s) (or the schema folder for Prisma's
  multi-file mode). A parser that does not implement it simply contributes nothing to the
  watch set beyond `tako.config.ts`.

Alternatives considered:

- **`ParseContext.registerWatchFile(path)` + `RunResult.watchedPaths`.** Rejected for v1:
  widens `ParseContext` (a contract `drift-guard` must also honour —
  [core-pipeline/technical.md](../core-pipeline/technical.md) keeps it minimal on
  purpose), and couples the watch set to a full `run()`. `watchPaths?()` is queryable
  without parsing.
- **CLI globs `**/*.prisma` under `cwd`.** Rejected: guesses the source kind, misbehaves
  for non-Prisma parsers, and watches the whole tree (noisy, and the output dir would
  self-trigger).
- **Read `config.sources[ns].options` in the CLI.** Rejected: `options` is retained on
  `ResolvedConfig` as opaque `unknown` for debugging only
  ([core-pipeline/technical.md §Driver options](../core-pipeline/technical.md)); the CLI
  would have to special-case every parser's schema-path key.

## Reporter (`reporter.ts`)

`ConsoleReporter implements Logger` (the `@kurotako/core` interface:
`debug/info/warn/error(msg, meta?)`).

- **Streams.** Human output goes to **stderr**; `stdout` stays clean (nothing machine-
  readable is emitted in v1, but keeping the split means a future `--json` can own stdout
  without a breaking change).
- **Levels.** Default shows `info` / `warn` / `error`. `debug` is dropped unless
  `TAKO_DEBUG` / `--debug` (a hidden flag, not advertised — kept minimal). No `--verbose`,
  no `--quiet` in v1 (overview).
- **Format (minimal, overview).** One line per phase, driven by the `info` calls `run()`
  and `loadConfig` already make through the injected logger, plus a closing summary line
  the command prints itself from `RunResult`:
  ```
  tako  config loaded (tako.config.ts)
  tako  parsing pg
  tako  generating zod, angular
  tako  wrote 14 files -> generated/kurotako
  ```
  (exact per-phase wording owned by the phase code; the reporter only prefixes `tako ` and
  colourises the level). Watch mode adds a `--- rebuild (schema.prisma changed) ---`
  separator per cycle and a `watching N paths` line after setup.
- **Colour.** Via `citty`'s bundled `consola`/ansi util if convenient, else a 10-line
  helper; auto-disabled when `!process.stderr.isTTY` or `NO_COLOR` is set.
- **Child logger.** `reporter.child(tag)` returns a `Logger` that prefixes `meta` with
  `{ scope: tag }` — matches what `run()` expects to tag contexts with the namespace /
  generator name ([core-pipeline/technical.md §Logger](../core-pipeline/technical.md)).

## Errors and exit codes (`errors.ts`, `cli.ts`)

`cli.ts` wraps the whole dispatch in one handler:

```ts
try {
  await command(...)
  process.exitCode ??= 0
} catch (e) {
  if (e instanceof TakoError) {
    reporter.error(renderError(e))          // "error [config_not_found]: no tako.config.ts found (looked in …)"
    process.exitCode = 1
  } else {
    reporter.error('internal error (this is a bug):')
    console.error(e)                        // full stack — unexpected
    process.exitCode = 1
  }
}
```

- Every domain error (`ConfigError` subclasses from `@kurotako/config`, `TakoError`
  subclasses from `@kurotako/core`, and this package's `ConfigExistsError`) is a
  `TakoError` — one `instanceof` covers all of them
  ([config-system/technical.md §Errors](../config-system/technical.md)).
- `renderError(e)` formats `error [<code>]: <message>` and appends the carried context
  when present: located issues (`ConfigShapeError`, `IrValidationError`,
  `DriverOptionsError`), the offending generator/namespace (`DriverError`,
  `UnknownNamespaceError`), the dependency cycle path (`DependencyCycleError`).
- **Exit codes.** `0` success; `1` any `TakoError` or unexpected throw. No finer taxonomy
  in v1 (overview: "non-zero on any error"). citty's own usage errors (unknown command /
  flag) exit `1` with its generated message.
- **Watch mode** overrides this: `cycle()` catches internally, the process only exits
  non-zero on an unrecoverable startup failure (e.g. `chokidar` cannot watch), exit `0` on
  `SIGINT`.

## `--version` injection

`bin/tako.ts` needs the package version. tsup `define` (`__TAKO_VERSION__` replaced with
`pkg.version` at build) keeps the bin dependency-free and avoids a runtime
`readFile('package.json')` that breaks once bundled. The bootstrap skeleton's placeholder
`version` const ([task 6](../../tasks/6-package-skeletons.md)) is replaced by this.

## Consequences verified against the current repo / other features

- **Nothing to migrate**: `packages/cli/src/` is the bootstrap placeholder. This feature
  rewrites it; `package.json` / `tsconfig.json` / `tsup.config.ts` / `vitest.config.ts`
  from [#6](../../tasks/6-package-skeletons.md) are unchanged except: add `citty` +
  `chokidar` + `@kurotako/config` + `@kurotako/core` deps, add the `../config` project
  reference, add `src/bin/tako.ts` to the tsup `entry` (already anticipated —
  [monorepo-bootstrap/technical.md §tsup](../monorepo-bootstrap/technical.md) "cli adds
  `src/bin/tako.ts`").
- **Additive contract change — `watchPaths?`** (see
  [above](#the-watchpaths-contract-addition)). Requires:
  - [config-system/technical.md](../config-system/technical.md) — add `watchPaths?` to
    `TakoParser<O>` in `types.ts` and curry it in `load.ts` (tasks
    [#22](../../tasks/22-config-types-and-errors.md) /
    [#25](../../tasks/25-config-load.md)).
  - [core-pipeline/technical.md](../core-pipeline/technical.md) — add the optional
    `watchPaths?(ctx: ParseContext)` member to `Parser` in `types.ts`; `run()` unchanged
    (task [#15](../../tasks/15-core-types-and-contracts.md)).
  - [parser-prisma/technical.md](../parser-prisma/technical.md) — `prismaParser`
    implements `watchPaths` (returns the resolved schema path(s)).
  All three are pure additions (optional member, no behaviour change to existing steps);
  documented here, to be reflected in those docs and their task files before those tasks
  are implemented.
- **core-pipeline open questions closed**: "log/report format", "handling driver errors"
  ([core-pipeline/technical.md §Consequences](../core-pipeline/technical.md)) are answered
  here — `ConsoleReporter` + `renderError` + single `TakoError` catch + exit 1.
- **config-system**: `tako generate` = `loadConfig()` then `run()`; `tako init` writes
  `CONFIG_TEMPLATE`; `tako validate` = `loadConfig()` + `run({ write: false })`; `--config`
  forwarded ([config-system/technical.md §Consequences "cli"](../config-system/technical.md)).
  Confirmed sufficient — no extra config surface needed by the CLI.
- **output-modes**: until [output-modes](../output-modes/technical.md) lands,
  `output.mode: 'package'` makes `run()` throw `UnsupportedOutputModeError`
  ([core-pipeline/technical.md §Writer seam](../core-pipeline/technical.md)); the CLI just
  renders it. When it lands, the `packageWriter` (in core) handles mode B transparently;
  the new `TakoError` subclasses (`OutputPeerConflictError`, `PackageBuildError`,
  `PackageInstallError`) need no CLI change — `renderError` already covers any `TakoError`.
  One small addition owned by the CLI reporter: after a successful **mode A** run, print
  once the `tsconfig` `paths` alias to add (`"@kurotako/*": ["<relative output dir>/*"]`) —
  `tako` never edits `tsconfig.json` itself
  ([output-modes/technical.md §directoryWriter](../output-modes/technical.md#directorywriter-mode-a--unchanged-one-addition)).
- **drift-guard**: `tako check` ([drift-guard/technical.md](../drift-guard/technical.md))
  is a fifth command in this same tree (`commands/check.ts` + `diff.ts`), reusing
  `ConsoleReporter`, `renderError` and the top-level `TakoError` handler. It does **not**
  diff `RunResult.files` (that sketch is superseded): it calls
  `run(config, { logger, plan: true })` and compares the resulting
  `RunResult.plan: PlannedFile[]` (absolute path + exact bytes, computed by each output's
  `Writer.plan()`, mode B included) against disk in memory via `comparePlanToDisk`
  (`modified` / `missing` / `orphan`, wholly-orphan directories collapsed). Exit 0 in
  sync, exit 1 on any drift or `TakoError`. Delivered by task #53; the `plan` primitive by
  tasks #51 / #52.
- **docs**: [docs/architecture.md §CLI](../../../docs/architecture.md) ("Envisaged
  commands: `tako generate`, `tako init`. Watch / incremental: open questions") and
  [docs/vision.md §6](../../../docs/vision.md#open-questions) are now settled — reconcile
  the prose when this lands (doc-only, not this phase).

## Tests (vitest, colocated)

- `init`: writes `tako.config.ts` into cwd; refuses when it exists (exit 1,
  `config_exists`); `--force` overwrites; `--config <path>` retargets; written content
  equals `CONFIG_TEMPLATE`.
- `generate` with a fake config file + fake in-memory driver modules (via `jiti` on a temp
  dir, mirroring [config-system tests](../config-system/technical.md#tests-vitest-colocated)):
  - happy path writes files and exits 0, summary line matches;
  - `--dry-run` writes nothing, prints "would be written", exits 0;
  - a driver that throws → exit 1, `renderError` names the driver;
  - a missing `tako.config.ts` → exit 1, `config_not_found`.
- `validate`: valid project exits 0; a config whose generator DAG has a cycle exits 1 with
  the cycle path; writes nothing to disk in either case.
- `watch.ts` (fake timers + a temp dir):
  - initial cycle runs once; touching a watched schema file triggers exactly one rebuild
    after the debounce;
  - a burst of N events → one rebuild;
  - a change mid-run aborts the previous `run()` (assert the passed `signal` fired) and
    runs again;
  - `loadConfig` failure keeps the watcher alive and watching `tako.config.ts`; fixing the
    file recovers;
  - editing the config to add a source extends the watch set; removing it shrinks it;
  - `SIGINT` closes the watcher and exits 0.
- `errors`: `renderError` for each carried-context error class produces the expected
  single-line-plus-detail string.
- `reporter`: `debug` suppressed by default, shown with `--debug`; colour off when not a
  TTY / `NO_COLOR`; human output on stderr, stdout untouched.
- bin smoke (CI, from bootstrap): `node dist/bin/tako.js --version` and the `bun` variant
  print the version.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#44 cli-scaffold-reporter-errors](../../tasks/44-cli-scaffold-reporter-errors.md) —
   package wiring (`citty`, `chokidar`, `../config` ref, bin entry, `__TAKO_VERSION__`),
   `reporter.ts` (`ConsoleReporter implements Logger`), `errors.ts` (`renderError`,
   `ConfigExistsError`), `cli.ts` (citty tree + `sharedArgs` + top-level `TakoError`
   catch), `bin/tako.ts`, barrel (deps: #6, #15, #22).
2. [#45 cli-init-command](../../tasks/45-cli-init-command.md) — `commands/init.ts`: write
   `CONFIG_TEMPLATE` into cwd, `--force`, refuse-if-exists (deps: #44, #22).
3. [#46 cli-generate-validate-commands](../../tasks/46-cli-generate-validate-commands.md) —
   `commands/generate.ts` (`loadAndRun` helper, `--dry-run`) + `commands/validate.ts`
   (`run({ write: false })`) (deps: #44, #25, #21).
4. [#47 cli-watch-mode](../../tasks/47-cli-watch-mode.md) — `watch.ts` `watchAndRun()`:
   chokidar loop, debounce + `AbortController` supersede, `watchPaths` union + reconcile,
   `SIGINT` shutdown; wire the `--watch` flag (deps: #46, #25, #21).

The `watchPaths?()` contract addition is folded into the upstream tasks it touches: #15
(`Parser.watchPaths?`), #22 / #25 (`TakoParser.watchPaths?` + currying), #26
(`prismaParser` implementation).
