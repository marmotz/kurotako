# backend — @kurotako/cli scaffold: citty tree, reporter, error rendering

**Status**: done
**Type**: backend
**Issue**: [#44](https://github.com/marmotz/kurotako/issues/44)

Reference: [../features/cli/technical.md §Package](../features/cli/technical.md#package),
[§Command surface](../features/cli/technical.md#command-surface-clits),
[§Reporter](../features/cli/technical.md#reporter-reporterts),
[§Errors and exit codes](../features/cli/technical.md#errors-and-exit-codes-errorsts-clits),
[§`--version` injection](../features/cli/technical.md#--version-injection).

## Verified

- `packages/cli/` is one of the seven skeletons scaffolded by [#6](6-package-skeletons.md):
  `src/index.ts` (`export const version` placeholder + trivial test), plus the CLI-specific
  `src/bin/tako.ts` (shebang `#!/usr/bin/env node`), `"bin": { "tako": "./dist/bin/tako.js" }`
  and a working `--version` (task 6 step 3). This task replaces the placeholder with the
  real command tree.
- `@kurotako/core` [#15](15-core-types-and-contracts.md) provides the `Logger` interface
  and the `TakoError` base value; `@kurotako/config` [#22](22-config-types-and-errors.md)
  provides `CONFIG_TEMPLATE` and the `ConfigError` subclasses (all `extends TakoError`).
- Toolchain: tsup keeps the bin **ESM only** (library entry stays dual); Node >= 24; no
  `Bun.*` — the bin is CI-smoke-run under both Node and Bun
  ([../features/monorepo-bootstrap/technical.md](../features/monorepo-bootstrap/technical.md)).

## To do

1. `packages/cli/package.json` — add `dependencies`: `@kurotako/config` (`workspace:*`),
   `@kurotako/core` (`workspace:*`), `citty`, `chokidar` (`^4`). Keep `"sideEffects": false`
   on the library entry. Keep `"bin"` from #6.
2. `packages/cli/tsconfig.json` — `references: [{ "path": "../config" }, { "path": "../core" }]`.
3. `packages/cli/tsup.config.ts` — add `src/bin/tako.ts` to `entry` (already anticipated by
   the bootstrap preset note); `define: { __TAKO_VERSION__: JSON.stringify(pkg.version) }`.
4. `packages/cli/src/reporter.ts` — `ConsoleReporter implements Logger` (`@kurotako/core`):
   - human output to **stderr**, `stdout` left clean;
   - levels `info`/`warn`/`error` shown by default, `debug` only with `--debug` /
     `TAKO_DEBUG` (hidden);
   - `tako ` prefix + level colourisation; colour auto-off when `!process.stderr.isTTY`
     or `NO_COLOR` set;
   - `child(tag)` returns a `Logger` prefixing `meta` with `{ scope: tag }`;
   - no `--verbose` / `--quiet` (out of scope for v1).
5. `packages/cli/src/errors.ts`:
   - `class ConfigExistsError extends TakoError` (`code: 'config_exists'`) for `tako init`;
   - `renderError(e: TakoError): string` — `error [<code>]: <message>` plus carried
     context when present (located `issues`, offending generator/namespace, dependency
     cycle path).
6. `packages/cli/src/cli.ts` — `runCli(argv: string[]): Promise<void>`:
   - build the citty command tree (`defineCommand`) with sub-commands `init` / `generate`
     / `validate` **registered but delegating to their own modules** (created in the
     follow-up tasks — stub them here as `throw new Error('not implemented')` or land this
     task first, see Dependencies);
   - a shared `sharedArgs` object carrying `config: { type: 'string' }` spread into every
     sub-command's `args`; hidden `debug` boolean;
   - `--version` from `__TAKO_VERSION__`, `--help` from citty;
   - top-level `try/catch`: `TakoError` → `reporter.error(renderError(e))` +
     `process.exitCode = 1`; unexpected throw → `reporter.error('internal error (this is
     a bug):')` + `console.error(e)` + exit 1; success → `process.exitCode ??= 0`.
7. `packages/cli/src/bin/tako.ts` — shebang, `import { runCli } from '../cli.js'`,
   `runCli(process.argv.slice(2))`.
8. `packages/cli/src/index.ts` — library barrel: re-export `runCli`, `ConsoleReporter` (+
   its types), `renderError`, `ConfigExistsError`. Drop the placeholder `version` const.
9. Tests (colocated vitest):
   - `reporter.test.ts` — `debug` suppressed by default, shown with the flag; colour off
     when not a TTY / `NO_COLOR`; writes to stderr, stdout untouched; `child` prefixes
     `meta`.
   - `errors.test.ts` — `renderError` for each carried-context error class (located
     issues, driver name, cycle path) produces the expected single-line-plus-detail
     string; `ConfigExistsError instanceof TakoError` with the right `code`.
   - `cli.test.ts` — `--version` prints `__TAKO_VERSION__`; unknown command exits 1 with
     citty's message; an unknown flag exits 1.
10. `bun run typecheck`, `bun run test`, `bun run build` green; `node dist/bin/tako.js
    --version` and `bun dist/bin/tako.js --version` print the version.

## Dependencies

- [6-package-skeletons](6-package-skeletons.md)
- [15-core-types-and-contracts](15-core-types-and-contracts.md)
- [22-config-types-and-errors](22-config-types-and-errors.md)
