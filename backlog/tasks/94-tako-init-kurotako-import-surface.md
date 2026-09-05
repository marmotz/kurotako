# backend — `tako init` writes `import { defineConfig } from 'kurotako'`

**Status**: to do
**Type**: backend
**Issue**: [#94](https://github.com/marmotz/kurotako/issues/94)

Reference: [../features/meta-package/technical.md §Découpage en tâches d'implémentation](../features/meta-package/technical.md#découpage-en-tâches-dimplémentation),
[../features/meta-package/overview.md — Decisions made](../features/meta-package/overview.md).

Follow-up from the post-merge review of [86-meta-package-kurotako](86-meta-package-kurotako.md):
a project that installs only `kurotako` and runs `npx tako init` gets a config whose
first line imports `@kurotako/config`, contradicting the "install one name" story. The
`meta-package` overview's open question ("always `kurotako`") is now an acted decision.

## Verified

- `packages/config/src/template.ts` — `CONFIG_TEMPLATE` opens with
  `import { defineConfig } from '@kurotako/config'`. It is re-exported from the package
  index and written verbatim by `tako init`
  (`packages/cli/src/commands/init.ts:9,41`).
- `packages/config/src/template.test.ts` parses `CONFIG_TEMPLATE` through
  `TakoConfigSchema` — a string-content assertion can be added there.
- `apps/docs/docs/reference/tako-config.md:13` still shows
  `import { defineConfig } from '@kurotako/config';`. `apps/docs/docs/reference/cli.md:8`
  frames `@kurotako/cli` as the install ("The `@kurotako/cli` package installs the `tako`
  binary").
- `apps/docs/docs/getting-started/installation.md` and `quick-start.md` already use
  `kurotako` / `import { defineConfig } from 'kurotako'` — no change needed there.
- `@kurotako/config` stays published; a project depending on it directly just edits the
  one import line (documented escape hatch).

## To do

1. `packages/config/src/template.ts`: `CONFIG_TEMPLATE` first line →
   `import { defineConfig } from 'kurotako'`. Apply the same to
   `CONFIG_TEMPLATE_MONOREPO` (introduced by [90-cli-tako-init-monorepo](90-cli-tako-init-monorepo.md)).
2. `packages/config/src/template.test.ts`: assert both template strings import from
   `'kurotako'` (and not from `'@kurotako/config'`).
3. `apps/docs/docs/reference/tako-config.md`: example import → `from 'kurotako'`; keep the
   closing note that `@kurotako/config` is the direct-dependency form.
4. `apps/docs/docs/reference/cli.md`: reword the opening so `kurotako` is the install that
   provides `tako`, with `@kurotako/cli` as the standalone/programmatic package; leave the
   `runCli` section as-is.
5. Changeset for `@kurotako/config` (the `tako init` output changes — user-facing).
6. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/config` and
   `packages/cli`; docs build green.

## Dependencies

Depends on #90

- [90-cli-tako-init-monorepo](90-cli-tako-init-monorepo.md) — introduces
  `CONFIG_TEMPLATE_MONOREPO`; both templates must end up importing from `'kurotako'`.
  Order this task after #90 (or fold step 1's monorepo half into #90 if it lands first).
