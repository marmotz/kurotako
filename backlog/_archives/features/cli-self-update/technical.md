# CLI self-update check — technical design

See [overview.md](overview.md) for the product-level decisions this design implements
(scope, no auto-update, background check for the binary, on-demand check for
`@kurotako/*` packages).

## Current state

- The `tako` binary is published by two npm packages, both declaring `bin.tako`:
  - `kurotako` ([`packages/kurotako/package.json`](../../../../packages/kurotako/package.json)) —
    the meta-package end users install (`npm i kurotako`). Its
    [`src/bin/tako.ts`](../../../../packages/kurotako/src/bin/tako.ts) intercepts
    `--version`/`-v` itself and prints its **own** `__TAKO_VERSION__` (injected from
    its own `package.json` at build time via
    [`tsup.config.ts`](../../../../packages/kurotako/tsup.config.ts)), then delegates
    everything else to `runCli()` from `@kurotako/cli`.
  - `@kurotako/cli` ([`packages/cli/package.json`](../../../../packages/cli/package.json)) —
    the package that implements the CLI itself. Its own
    [`src/bin/tako.ts`](../../../../packages/cli/src/bin/tako.ts) and
    [`src/cli.ts:18-20`](../../../../packages/cli/src/cli.ts) declare and use their own
    `__TAKO_VERSION__`, injected the same way from `packages/cli/package.json`.
  - The two versions are independent (changesets are per-package): today `kurotako` is
    at `0.2.1`, `@kurotako/cli` at `0.1.3`. This is why `tako --version` shows `0.2.1`
    for a `kurotako` install — it never reaches `@kurotako/cli`'s own version constant
    for that flag.
- No existing cache/config directory helper (no `os.homedir()`, XDG, or `envPaths`
  usage anywhere in the repo), no existing HTTP client dependency (no `fetch`, `axios`,
  `node-fetch`, `undici` usage found) — both are introduced by this feature. Node >= 24
  provides global `fetch`, no new dependency needed.
- Commands are defined with `citty` and registered in
  [`src/cli.ts:22-27`](../../../../packages/cli/src/cli.ts) (`subCommands` object). See
  [`src/commands/check.ts`](../../../../packages/cli/src/commands/check.ts) for the
  pattern a new command follows: `defineCommand({ meta, args: { ...sharedArgs }, run })`
  using `ConsoleReporter` for output.
- [`packages/config/src/resolve.ts`](../../../../packages/config/src/resolve.ts) walks up
  from `cwd` to find `tako.config.ts`, stopping at a `.git` directory — the closest
  existing notion of "project root" to reuse for locating the target project's
  `package.json`.

## Scope decision: which version identifies "the CLI"

The background check compares against the npm package **`kurotako`** (product
decision). Since `__TAKO_VERSION__` inside `@kurotako/cli` is *not* that version, the
check needs the caller to supply the right "current version" explicitly rather than
reading `@kurotako/cli`'s own constant:

- `runCli()` gains an optional second parameter: `runCli(argv, { currentVersion? })`.
- `packages/kurotako/src/bin/tako.ts` passes its own `__TAKO_VERSION__` (the version
  the user actually installed).
- `packages/cli/src/bin/tako.ts` (standalone `@kurotako/cli` install, not the
  recommended path) keeps calling `runCli(argv)` without the option; `runCli` falls
  back to its own local `VERSION` constant in that case. A standalone `@kurotako/cli`
  install will therefore compare its own (lower, independently-versioned) number
  against `kurotako`'s latest release and may show a permanently-stale notice — this is
  an accepted limitation of an unsupported install path, not something this feature
  fixes.

## Background version check (the `tako` binary)

New module `packages/cli/src/version-check.ts`:

```ts
export interface VersionCacheEntry {
  checkedAt: number;      // epoch ms
  latestVersion: string;
}

export function getCacheFilePath(): string;                    // ~/.cache/tako/version-check.json (XDG_CACHE_HOME if set)
export function readCache(): VersionCacheEntry | undefined;     // undefined on missing/corrupt file
export function writeCache(entry: VersionCacheEntry): void;
export async function refreshLatestVersion(signal: AbortSignal): Promise<string>; // GET https://registry.npmjs.org/kurotako/latest
export function checkForUpdate(currentVersion: string): { notice?: string; refresh?: Promise<void> };
```

Cache location: `join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'tako', 'version-check.json')`.
No existing precedent in the repo for this path; this follows the standard XDG base
directory convention, cross-platform enough for the project's supported runtimes
(Node/Bun on POSIX; no Windows-specific handling needed today, matching the rest of the
CLI which doesn't special-case Windows paths either).

TTL: 8h, per the product decision. `checkForUpdate`:

1. Read the cache file.
2. If a `latestVersion` is cached and semver-greater than `currentVersion` (using
   `semver`-equivalent comparison — see "Dependencies" below), return a `notice`
   string to print.
3. If the cache is missing or older than 8h, also return a `refresh` promise that
   performs the registry fetch and rewrites the cache — this is what makes the *next*
   invocation aware of a newer version, this one already committed to whatever
   `notice` (if any) it computed from the stale/absent cache.

Non-blocking mechanism: `refresh` is started with an `AbortController`. `runCli()`
starts it right after dispatching the command, awaits the command's own result as
normal, and — right before returning — aborts the controller if `refresh` hasn't
settled yet:

```ts
// cli.ts, inside runCli()
const controller = new AbortController();
const { notice, refresh } = checkForUpdate(currentVersion);
if (notice) {
  reporter.info(notice);
}

try {
  await runCommand(main, { rawArgs: argv });
  process.exitCode ??= 0;
} catch (error) {
  // ...existing error handling...
} finally {
  controller.abort();
  await refresh?.(controller.signal).catch(() => {}); // best-effort, already aborted if too slow
}
```

This piggybacks the registry call on however long the command itself takes: a slow
`generate` gives it ample time to complete and refresh the cache; a fast command (e.g.
`--help`) aborts it almost immediately and the cache simply stays stale until a slower
invocation comes along. No fixed timeout constant, no added latency ever, no detached
child process — accepted trade-off from the product discussion in favor of simplicity.
Network/parse errors are swallowed silently (never surface as a CLI failure).

The notice itself is printed via `reporter.info(...)`, e.g.:

```
tako a new version of kurotako is available: 0.2.1 → 0.3.0 (npm i kurotako@latest)
```

printed once per invocation when the cached `latestVersion` is newer, on stderr like
the rest of `ConsoleReporter` output, never altering `process.exitCode`.

## `tako outdated` command (the `@kurotako/*` project packages)

New file [`packages/cli/src/commands/outdated.ts`](../../../../packages/cli/src/commands/outdated.ts),
registered in `subCommands` in [`src/cli.ts`](../../../../packages/cli/src/cli.ts) next to
`init` / `generate` / `validate` / `check`.

Discovery, reusing the project-root logic already in
[`resolveConfigFile`](../../../../packages/config/src/resolve.ts) (same `.git`-anchored
walk-up, `--config`-independent — `outdated` only needs the project's `package.json`,
not its `tako.config.ts`):

1. Find the nearest `package.json` walking up from `cwd` (same stop condition as
   `resolveConfigFile`: reaching a directory containing `.git`).
2. Collect every dependency/devDependency key matching `/^@kurotako\//`.
3. For each, resolve its **installed** version by reading
   `<packageName>/package.json` through `createRequire(<project package.json path>).resolve(...)`
   — this follows the actual module resolution (works under npm, pnpm, and Bun's
   workspace/hoisting layouts) rather than assuming a flat `node_modules/`.
4. Query `https://registry.npmjs.org/<packageName>/latest` for each, in parallel (no
   cache — on-demand only, per the product decision).
5. Print a table: package name, installed version, latest version, and a marker for
   packages that are behind.

```
tako outdated
  package                installed   latest    status
  @kurotako/core         0.1.2       0.1.2     up to date
  @kurotako/parser-prisma 0.1.0      0.1.1     outdated
  @kurotako/gen-zod       0.1.3      0.1.3     up to date
```

Exit code: `0` always (informational command, matching `overview.md`'s
"notification-only" decision — this is not a CI gate). A package that fails to resolve
on the registry (network error, unpublished scope) is listed with `latest: unknown`
rather than failing the whole command.

## Dependencies

- No new runtime dependency for HTTP (global `fetch`).
- A minimal semver-comparison need (`is A newer than B`) — checked whether `semver` is
  already a transitive dependency anywhere convenient; if not, a small local helper
  (`compareVersions(a, b): -1 | 0 | 1` handling `major.minor.patch` plus an optional
  prerelease suffix) is enough, since the project's own versions are plain semver from
  changesets. No need for the full `semver` package's range-matching features this
  feature doesn't use.

## Testing

- `version-check.ts`: unit tests for `readCache`/`writeCache` (temp dir), and
  `checkForUpdate`'s notice/no-notice branching against a fixed cache content —
  network call itself mocked (inject a fetch function rather than using the global,
  mirroring how `ConsoleReporter` takes an injectable `stream`).
- `commands/outdated.ts`: unit test with a fixture project directory (temp dir with a
  `package.json` + fake `node_modules/@kurotako/*` packages) and a mocked registry
  fetch, asserting the printed table content for a mix of up-to-date/outdated/unresolvable
  packages.
- `cli.ts`: extend the existing `runCli` tests to cover the `currentVersion` parameter
  and that the abort-on-exit behavior doesn't delay `runCli`'s own resolution (fake
  timers / a fetch mock that never resolves, asserting `runCli` still returns
  promptly).

## Implementation task breakdown

- [#171 — Background version check for the tako binary](https://github.com/marmotz/kurotako/issues/171)
- [#172 — tako outdated: on-demand check of installed @kurotako/* packages](https://github.com/marmotz/kurotako/issues/172) (depends on #171)
