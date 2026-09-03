# backend — @kurotako/config file resolution (resolveConfigFile)

**Status**: done
**Type**: backend
**Issue**: [#24](https://github.com/marmotz/kurotako/issues/24)

Reference: [../features/config-system/technical.md §File resolution (`resolve.ts`)](../features/config-system/technical.md#file-resolution-resolvets).

## Verified

- Overview decision: fixed name `tako.config.ts`, walk up from `cwd`, `--config <path>`
  override, `.ts` only.
- No `Bun.*` — use `node:fs` / `node:path`.

## To do

1. `packages/config/src/resolve.ts` — `export function resolveConfigFile(opts: { cwd: string; configPath?: string }): string`:
   - `configPath` set: resolve against `cwd`; must exist and end in `.ts` / `.mts` /
     `.cts`; missing or wrong extension → `ConfigNotFoundError`.
   - otherwise: look for `tako.config.ts` in `cwd`, then each parent, first hit wins;
     stop the walk at a directory containing `.git` (check that dir inclusively) or at the
     filesystem root; none found → `ConfigNotFoundError` listing the directories tried.
   - return the absolute path.
2. Add `resolveConfigFile` to the `index.ts` barrel.
3. `packages/config/src/resolve.test.ts` (temp dirs):
   - finds `tako.config.ts` in `cwd`;
   - finds it two directories up;
   - stops at a `.git`-containing dir (does not escape above it);
   - `ConfigNotFoundError` when absent, message lists tried dirs;
   - `--config` path honoured; missing `--config` path → `ConfigNotFoundError`;
   - `--config` pointing at a `.json` → `ConfigNotFoundError`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [22-config-types-and-errors](22-config-types-and-errors.md)
