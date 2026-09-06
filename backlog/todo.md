# Backlog — tracking

Each feature goes through `backlog-discuss` then `backlog-technical` before `backlog-tasks`.
GitHub issues live on `marmotz/kurotako` (see [AGENTS.md](AGENTS.md)). Completed features
are archived in [`_archives/done.md`](_archives/done.md).

## Docs reconciliation (post-MVP)

Cross-cutting cleanup, owned by no single feature: the feature `technical.md` files locked
decisions that now contradict `docs/architecture.md`, `docs/vision.md` and `docs/ir.md`.
Done once the MVP contracts stop moving; not on the critical path.

| Done | Issue                                                | Task                                                                        | Description                                                                                                                                                                    |
|------|------------------------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|      | [#60](https://github.com/marmotz/kurotako/issues/60) | [60-docs-reconciliation-post-mvp](tasks/60-docs-reconciliation-post-mvp.md) | Reconcile `architecture.md` (contracts, hard `zod` dep, output tree, `.ts` config, CLI set), `vision.md` (close the settled open questions), `ir.md` (close the 3 open points) |

## `kurotako` meta-package

[features/meta-package/overview.md](features/meta-package/overview.md) — technical design:
[technical.md](features/meta-package/technical.md). Single published package `kurotako`
(unscoped) that depends on `@kurotako/cli` + `@kurotako/config` and re-exports
`defineConfig`, so a project installs one name and writes
`import { defineConfig } from 'kurotako'`. The parts stay published for advanced use.

| Done | Issue                                                | Task                                                          | Description                                                                        |
|------|------------------------------------------------------|--------------------------------------------------------------|-----------------------------------------------------------------------------------|
| [x]  | [#86](https://github.com/marmotz/kurotako/issues/86) | [86-meta-package-kurotako](tasks/86-meta-package-kurotako.md) | `packages/kurotako` — bin re-exposes `tako` (own `--version`), barrel re-exports `defineConfig`; docs + CI smoke |
| [x]  | [#94](https://github.com/marmotz/kurotako/issues/94) | [94-tako-init-kurotako-import-surface](tasks/94-tako-init-kurotako-import-surface.md) | `tako init` writes `import { defineConfig } from 'kurotako'`; `reference/*` docs follow (post-merge review follow-up, depends on #90) |
