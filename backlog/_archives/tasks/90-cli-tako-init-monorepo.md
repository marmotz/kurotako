# backend — `tako init --monorepo`: flag, auto-detection, `CONFIG_TEMPLATE_MONOREPO`

**Status**: done
**Type**: backend
**Issue**: [#90](https://github.com/marmotz/kurotako/issues/90)

Reference: [../features/monorepo-projects/technical.md §2.6](../features/monorepo-projects/technical.md#26-tako-init---monorepo-cli--config).

## Verified

- `packages/cli/src/commands/init.ts:15-45` — `initCommand` (citty) has args
  `...sharedArgs` + `force`; `run` resolves `target` under `cwd`, refuses to overwrite
  without `--force`, then `writeFile(target, CONFIG_TEMPLATE, 'utf8')` and
  `reporter.info(...)`.
- `packages/config/src/template.ts` — exports the single `CONFIG_TEMPLATE` string; it is
  re-exported from `@kurotako/config`'s index and imported by the CLI as
  `import { CONFIG_TEMPLATE } from '@kurotako/config'` (`init.ts:9`).
- `packages/config/src/template.test.ts` — parses `CONFIG_TEMPLATE` through
  `TakoConfigSchema` to guarantee the skeleton is valid.
- `packages/cli/src/commands/init.test.ts` / `init.test-d.ts` — behavior + arg-type tests.

## To do

1. `packages/config/src/template.ts`: add `export const CONFIG_TEMPLATE_MONOREPO` — same
   shape as `CONFIG_TEMPLATE` but:
   - `sources` example: `options: { schema: './libs/db/prisma/schema.prisma' }`;
   - `outputs`: two entries targeting different sub-projects, using the `generators`
     filter (e.g. `{ dir: './libs/db/src/generated', generators: ['zod'] }` and
     `{ dir: './apps/web/src/generated' }`);
   - a comment block: `@prisma/internals` may be installed in the sub-project holding the
     schema (not necessarily the repo root); `options.schema` stays relative to this
     config file.
   Export it from the package index alongside `CONFIG_TEMPLATE`. Import line:
   `import { defineConfig } from 'kurotako'` if [#94](https://github.com/marmotz/kurotako/issues/94)
   has landed, otherwise `'@kurotako/config'` and #94 flips both templates.
2. `packages/config/src/template.test.ts`: `CONFIG_TEMPLATE_MONOREPO` also parses under
   `TakoConfigSchema`.
3. `packages/cli/src/commands/init.ts`:
   - new boolean arg `monorepo` (citty, `default: undefined`; `--monorepo` /
     `--no-monorepo`).
   - when `undefined`, auto-detect: walk up from `cwd` for the first `package.json`;
     monorepo when it has a `workspaces` key (array, or `{ packages: [...] }`); also treat
     a `pnpm-workspace.yaml` next to it as positive.
   - pick `CONFIG_TEMPLATE_MONOREPO` vs `CONFIG_TEMPLATE` accordingly; `reporter.info`
     states which mode was used (`created tako.config.ts (monorepo layout)`).
4. Tests `packages/cli/src/commands/init.test.ts` / `init.test-d.ts`:
   - `--monorepo` ⇒ monorepo template written even with a plain `package.json`;
   - `--no-monorepo` ⇒ single-project template even when `workspaces` is present;
   - auto-detect: fixture dir with `workspaces` in `package.json` ⇒ monorepo template;
     fixture with `pnpm-workspace.yaml` ⇒ monorepo template; plain fixture ⇒ default
     template;
   - `monorepo` arg is typed `boolean | undefined`.
5. Changesets: `@kurotako/config` (new `CONFIG_TEMPLATE_MONOREPO` export) and
   `@kurotako/cli` (`tako init --monorepo` + auto-detection).
6. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/config` and
   `packages/cli`.

## Dependencies

Aucune. (Independent of the anchor mechanism — only touches `tako init` and the template
string.)
