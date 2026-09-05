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
[config-system/technical.md](../config-system/technical.md) §"Why a dedicated package")
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

## Open questions

- Does `tako --version` report the `kurotako` version or the underlying `@kurotako/cli`
  version? (Leaning: the `kurotako` version, injected at build — that is the number the
  user installed.)
- Should `tako init` write `import { defineConfig } from 'kurotako'` unconditionally, or
  detect whether the project depends on `kurotako` vs `@kurotako/config` directly?
  (Leaning: always `'kurotako'` — it is the documented path; a direct `@kurotako/config`
  user can edit one line.)

## Depends on

- [cli](../cli/overview.md) — the binary being re-exposed.
- [config-system](../config-system/overview.md) — the `defineConfig` surface being
  re-exported.
- [monorepo-bootstrap](../monorepo-bootstrap/overview.md) — a new package skeleton, the
  bin smoke-test matrix, changesets.
