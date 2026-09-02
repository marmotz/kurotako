# backend — @kurotako/cli `tako init` command

**Status**: to do
**Type**: backend
**Issue**: [#45](https://github.com/marmotz/kurotako/issues/45)

Reference: [../features/cli/technical.md §`tako init`](../features/cli/technical.md#tako-init-commandsinitts).

## Verified

- `CONFIG_TEMPLATE` is exported by `@kurotako/config` [#22](22-config-types-and-errors.md).
- The command tree, `sharedArgs` (`--config`), `ConsoleReporter` and `ConfigExistsError`
  are provided by the cli scaffold task.
- Product decisions ([../features/config-system/overview.md](../features/config-system/overview.md)):
  fixed commented skeleton only, no prompts, no schema auto-detection, refuse to overwrite.

## To do

1. `packages/cli/src/commands/init.ts` — `defineCommand`:
   - args: `sharedArgs` (`--config`) + `force: { type: 'boolean', default: false }`.
   - `target` = `resolve(process.cwd(), 'tako.config.ts')`; `--config <path>` overrides the
     target path. `init` does **not** walk up (unlike `loadConfig`).
   - if `target` exists and `!force` → throw `ConfigExistsError` (propagates to the
     top-level handler, exit 1).
   - `mkdir -p` the parent, write `CONFIG_TEMPLATE` utf-8.
   - `reporter.info('created tako.config.ts')`.
2. Register the command in `cli.ts` (replace the stub).
3. Tests (colocated vitest, temp dir):
   - writes `tako.config.ts` into cwd; content equals `CONFIG_TEMPLATE`;
   - refuses when the file exists → exit 1, `code: 'config_exists'`;
   - `--force` overwrites;
   - `--config <path>` retargets the write.
4. `bun run typecheck` / `test` / `build` green.

## Dependencies

- [44-cli-scaffold-reporter-errors](44-cli-scaffold-reporter-errors.md)
- [22-config-types-and-errors](22-config-types-and-errors.md)
