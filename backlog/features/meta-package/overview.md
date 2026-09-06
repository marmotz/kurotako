# `kurotako` meta-package

**Status**: technical design — [technical.md](technical.md)

## Context

To use `tako` today a project must install **two** packages and know the boundary
between them:

- `@kurotako/cli` — the `tako` binary;
- `@kurotako/config` — exports `defineConfig`, which every `tako.config.ts` imports.

Nothing in the ecosystem works this way. `vite` is one package (`import { defineConfig }
from 'vite'`); `vitest` is one package (`import { defineConfig } from 'vitest/config'`).
The tool package **is** the config entry point. Splitting the two names leaks an internal
layering decision (`@kurotako/config` exists as a separate package for testing and
dependency-direction reasons — see
[config-system/technical.md](../../_archives/features/config-system/technical.md) §"Why a dedicated package")
onto every user.

The parser and generator packages are a different matter: those are genuinely opt-in per
project and stay separate installs. This feature is only about collapsing the
**always-needed** pair into one name.

## Goal

A single published package **`kurotako`** (unscoped — it is already the project name in
[docs/vision.md](../../../docs/vision.md), the `@kurotako/*` scope stays for the parts).

```bash
npm install -D kurotako          # or bun add -d / pnpm add -D / yarn add -D
```

gives:

- the `tako` binary on `PATH` (`npx tako …`, `bunx tako …`);
- `import { defineConfig } from 'kurotako'` in `tako.config.ts`.

`@kurotako/cli` and `@kurotako/config` remain published for advanced / programmatic use;
the docs simply stop mentioning them in the getting-started path.

## Decisions made

- **Meta-package, not a `@kurotako/cli/config` subpath.** A `vitest/config`-style subpath
  export on `@kurotako/cli` was considered and rejected: the user wants one *installable
  name*, and a meta-package keeps `@kurotako/cli` free of a config-facing entry.
- **Name `kurotako`, unscoped.** Consistent with `vite` / `vitest` and with the project
  name already locked in the vision. The binary stays `tako`.
- **Re-exports `defineConfig` and the config authoring surface** (`defineParser`,
  `defineGenerator`, the config types). It does **not** re-export the CLI's programmatic
  API (`runCli`, reporters) — that stays `@kurotako/cli` for the few who need it.
- **`@kurotako/config` stays published and public**, not made `private`. Cheap, and it
  keeps the door open for a non-CLI embedder.
- **Published, independently versioned** (changesets), like the other public packages.
- **`tako --version` reports the `kurotako` version**, injected at build — the number the
  user installed, not the underlying `@kurotako/cli` version. (Settled in
  [technical.md](technical.md); implemented in the meta bin.)
- **`tako init` writes `import { defineConfig } from 'kurotako'` unconditionally** — it is
  the documented install path; a project depending on `@kurotako/config` directly edits
  one line. This means `CONFIG_TEMPLATE` (and `CONFIG_TEMPLATE_MONOREPO`) and the
  getting-started / `reference/*` docs move off `@kurotako/config` as the authoring
  surface. Deferred out of the initial meta-package tasks; tracked as a follow-up task.

## Open questions

_(none)_

## Depends on

- [cli](../../_archives/features/cli/overview.md) — the binary being re-exposed.
- [config-system](../../_archives/features/config-system/overview.md) — the `defineConfig` surface being
  re-exported.
- [monorepo-bootstrap](../../_archives/features/monorepo-bootstrap/overview.md) — a new package skeleton, the
  bin smoke-test matrix, changesets.
