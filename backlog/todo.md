# Backlog — tracking

Design phase. Each feature goes through `backlog-discuss` then `backlog-technical` before
`backlog-tasks`. GitHub issues live on `marmotz/kurotako` (see [AGENTS.md](AGENTS.md)).

Suggested order: `monorepo-bootstrap` → `ir-model` → `core-pipeline` → `config-system`
→ `parser-prisma` → `generator-zod` → `generator-angular` → `cli` → `output-modes`.

## Monorepo bootstrap

[features/monorepo-bootstrap/overview.md](features/monorepo-bootstrap/overview.md) — technical
design: [technical.md](features/monorepo-bootstrap/technical.md)

| Done | Issue                                                | Task                                                                                  | Description                                                                                                         |
|------|------------------------------------------------------|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| [x]  | [#1](https://github.com/marmotz/kurotako/issues/1)   | [1-root-workspace-scaffold](tasks/1-root-workspace-scaffold.md)                       | Root `package.json`, Bun workspaces, `.gitignore`, `.node-version`, `.editorconfig`                                 |
| [x]  | [#2](https://github.com/marmotz/kurotako/issues/2)   | [2-shared-typescript-config](tasks/2-shared-typescript-config.md)                     | `tsconfig.base.json` + solution tsconfig, `typecheck` script                                                        |
| [x]  | [#3](https://github.com/marmotz/kurotako/issues/3)   | [3-tsup-build-preset](tasks/3-tsup-build-preset.md)                                   | `tsup.config.base.ts`, `build` script                                                                               |
| [x]  | [#4](https://github.com/marmotz/kurotako/issues/4)   | [4-vitest-workspace](tasks/4-vitest-workspace.md)                                     | `vitest.workspace.ts`, coverage, `test` script                                                                      |
| [x]  | [#5](https://github.com/marmotz/kurotako/issues/5)   | [5-biome-lint-format](tasks/5-biome-lint-format.md)                                   | `biome.json`, `lint`/`format` scripts                                                                               |
| [x]  | [#6](https://github.com/marmotz/kurotako/issues/6)   | [6-package-skeletons](tasks/6-package-skeletons.md)                                   | 7 `packages/*` skeletons (ir, core, config, cli, parser-prisma, gen-zod, gen-angular)                               |
| [x]  | [#7](https://github.com/marmotz/kurotako/issues/7)   | [7-lefthook-git-hooks](tasks/7-lefthook-git-hooks.md)                                 | `lefthook.yml`, `prepare` script                                                                                    |
| [x]  | [#8](https://github.com/marmotz/kurotako/issues/8)   | [8-changesets-release](tasks/8-changesets-release.md)                                 | `.changeset/config.json`, independent versioning                                                                    |
| [x]  | [#9](https://github.com/marmotz/kurotako/issues/9)   | [9-ci-workflow](tasks/9-ci-workflow.md)                                               | `.github/workflows/ci.yml`                                                                                          |
| [x]  | [#10](https://github.com/marmotz/kurotako/issues/10) | [10-repo-meta-files](tasks/10-repo-meta-files.md)                                     | `LICENSE`, `README`, `CONTRIBUTING`, `CODE_OF_CONDUCT`                                                              |
| [x]  | [#54](https://github.com/marmotz/kurotako/issues/54) | [54-apps-docs-workspace-accommodation](tasks/54-apps-docs-workspace-accommodation.md) | `apps/*` workspace for the docs site: `workspaces`, `.gitignore`, Biome, changesets, `CONTRIBUTING` (for docs-site) |

## IR model (`@kurotako/ir`)

[features/ir-model/overview.md](features/ir-model/overview.md) — technical design:
[technical.md](features/ir-model/technical.md)

| Done | Issue                                                | Task                                                          | Description                                                                   |
|------|------------------------------------------------------|---------------------------------------------------------------|-------------------------------------------------------------------------------|
| [x]  | [#11](https://github.com/marmotz/kurotako/issues/11) | [11-ir-types-and-version](tasks/11-ir-types-and-version.md)   | `src/schemas.ts` Valibot schemas + `src/types.ts` inferred + `src/version.ts` |
| [x]  | [#12](https://github.com/marmotz/kurotako/issues/12) | [12-ir-runtime-validation](tasks/12-ir-runtime-validation.md) | `validateIR`/`assertIR`/`parseIR` = Valibot parse + cross-ref pass            |
| [x]  | [#13](https://github.com/marmotz/kurotako/issues/13) | [13-ir-traversal-helpers](tasks/13-ir-traversal-helpers.md)   | `src/helpers.ts` resolution / iteration helpers                               |
| [x]  | [#14](https://github.com/marmotz/kurotako/issues/14) | [14-ir-source-builder](tasks/14-ir-source-builder.md)         | `src/builder.ts` fluent `createSourceIR()` + incremental validation           |

## Orchestration (`@kurotako/core`)

[features/core-pipeline/overview.md](features/core-pipeline/overview.md) — technical design:
[technical.md](features/core-pipeline/technical.md)

| Done | Issue                                                | Task                                                                | Description                                                                         |
|------|------------------------------------------------------|---------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| [x]  | [#15](https://github.com/marmotz/kurotako/issues/15) | [15-core-types-and-contracts](tasks/15-core-types-and-contracts.md) | `types.ts` (config, driver contracts, artifacts, hooks), `errors.ts`, `logger.ts`   |
| [x]  | [#16](https://github.com/marmotz/kurotako/issues/16) | [16-core-merge](tasks/16-core-merge.md)                             | `merge.ts` — `mergeSources()`, namespace-mismatch / duplicate rejection, `assertIR` |
| [x]  | [#17](https://github.com/marmotz/kurotako/issues/17) | [17-core-graph](tasks/17-core-graph.md)                             | `graph.ts` — `generatorOrder()`, Kahn, missing hard dep, cycle detection            |
| [x]  | [#18](https://github.com/marmotz/kurotako/issues/18) | [18-core-filter](tasks/18-core-filter.md)                           | `filter.ts` — `filterIR()` namespace-filtered deep clone                            |
| [x]  | [#19](https://github.com/marmotz/kurotako/issues/19) | [19-core-collect](tasks/19-core-collect.md)                         | `collect.ts` — `mergeTrees()`, path normalization, cross-generator collision        |
| [x]  | [#20](https://github.com/marmotz/kurotako/issues/20) | [20-core-writer](tasks/20-core-writer.md)                           | `writer.ts` — `Writer` seam + mode A `directoryWriter` (unconditional wipe)         |
| [x]  | [#21](https://github.com/marmotz/kurotako/issues/21) | [21-core-run](tasks/21-core-run.md)                                 | `run.ts` — orchestrator wiring every step + `afterEmit` hook + e2e tests            |

## Configuration system

[features/config-system/overview.md](features/config-system/overview.md) — technical design:
[technical.md](features/config-system/technical.md)

| Done | Issue                                                | Task                                                              | Description                                                                              |
|------|------------------------------------------------------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| [x]  | [#22](https://github.com/marmotz/kurotako/issues/22) | [22-config-types-and-errors](tasks/22-config-types-and-errors.md) | `types.ts` + `defineConfig` + `errors.ts` + `CONFIG_TEMPLATE`, package skeleton          |
| [x]  | [#23](https://github.com/marmotz/kurotako/issues/23) | [23-config-schema](tasks/23-config-schema.md)                     | `schema.ts` — `NAMESPACE_RE`, structural `TakoConfigSchema`, `normalizeIssues`           |
| [x]  | [#24](https://github.com/marmotz/kurotako/issues/24) | [24-config-resolve](tasks/24-config-resolve.md)                   | `resolve.ts` — `resolveConfigFile()` walk-up + `--config` override                       |
| [x]  | [#25](https://github.com/marmotz/kurotako/issues/25) | [25-config-load](tasks/25-config-load.md)                         | `load.ts` — `loadConfig()`: jiti import, validate, curry options, build `ResolvedConfig` |

## Prisma parser (`@kurotako/parser-prisma`)

[features/parser-prisma/overview.md](features/parser-prisma/overview.md) — technical design:
[technical.md](features/parser-prisma/technical.md)

| Done | Issue                                                | Task                                                              | Description                                                                                                                |
|------|------------------------------------------------------|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| [x]  | [#59](https://github.com/marmotz/kurotako/issues/59) | [59-prisma-getdmmf-spike](tasks/59-prisma-getdmmf-spike.md)       | **Spike, blocks #26**: verify `getDMMF` availability / call shape / Prisma version range in `@prisma/internals`            |
| [x]  | [#26](https://github.com/marmotz/kurotako/issues/26) | [26-prisma-parser-scaffold](tasks/26-prisma-parser-scaffold.md)   | Package scaffold: `options.ts` (`PrismaParserOptions`), `errors.ts`, `parser.ts` skeleton, deps (`@prisma/internals` peer) |
| [x]  | [#27](https://github.com/marmotz/kurotako/issues/27) | [27-prisma-input-detection](tasks/27-prisma-input-detection.md)   | `detect.ts` — `resolveInput()`: file / folder / `contract.json`, version-mode inference                                    |
| [x]  | [#28](https://github.com/marmotz/kurotako/issues/28) | [28-prisma-dmmf-reader](tasks/28-prisma-dmmf-reader.md)           | `dmmf/` — neutral `PrismaModel`, `getDMMF` wrapper, `DMMF.Document → PrismaModel`                                          |
| [x]  | [#29](https://github.com/marmotz/kurotako/issues/29) | [29-prisma-scalar-mapping](tasks/29-prisma-scalar-mapping.md)     | `map/scalars.ts` + `map/defaults.ts` — scalar / `@db.*` / `format` / `DefaultValue` mapping                                |
| [x]  | [#30](https://github.com/marmotz/kurotako/issues/30) | [30-prisma-relation-mapping](tasks/30-prisma-relation-mapping.md) | `map/relations.ts` — relation pairing, owning side, implicit-m2m materialisation                                           |
| [x]  | [#31](https://github.com/marmotz/kurotako/issues/31) | [31-prisma-sourceir-build](tasks/31-prisma-sourceir-build.md)     | `map/build.ts` — `buildSourceIR()` via `createSourceIR`, final wiring, e2e tests                                           |

## Zod generator (`@kurotako/gen-zod`)

[features/generator-zod/overview.md](features/generator-zod/overview.md) — technical
design: [technical.md](features/generator-zod/technical.md)

| Done | Issue                                                | Task                                                                      | Description                                                                                |
|------|------------------------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| [x]  | [#32](https://github.com/marmotz/kurotako/issues/32) | [32-gen-zod-scaffold](tasks/32-gen-zod-scaffold.md)                       | Package deps, `options.ts`, `errors.ts`, `names.ts`, `dialect.ts` (v3/v4), skeleton        |
| [x]  | [#33](https://github.com/marmotz/kurotako/issues/33) | [33-gen-zod-scalars-constraints](tasks/33-gen-zod-scalars-constraints.md) | `render/scalars.ts` + `constraints.ts` + `field.ts` — dialect-aware expression rendering   |
| [x]  | [#34](https://github.com/marmotz/kurotako/issues/34) | [34-gen-zod-variants-relations](tasks/34-gen-zod-variants-relations.md)   | `render/variants.ts` (full/create/update/where/select) + `relations.ts` (flat/deep)        |
| [x]  | [#35](https://github.com/marmotz/kurotako/issues/35) | [35-gen-zod-emit-enums-filters](tasks/35-gen-zod-emit-enums-filters.md)   | `emit/enums.ts` (const + `z.enum` + type) + `filters.ts` (Prisma-style Where operators)    |
| [x]  | [#36](https://github.com/marmotz/kurotako/issues/36) | [36-gen-zod-emit-entity-barrel](tasks/36-gen-zod-emit-entity-barrel.md)   | `emit/entity.ts` (per-entity file, all variants × families) + `barrel.ts`                  |
| [x]  | [#37](https://github.com/marmotz/kurotako/issues/37) | [37-gen-zod-artifact-and-run](tasks/37-gen-zod-artifact-and-run.md)       | `artifact.ts` (`GeneratorArtifact` + `ZodArtifactExtra`) + `generate()` wiring + e2e tests |

## Angular generator (`@kurotako/gen-angular`)

[features/generator-angular/overview.md](features/generator-angular/overview.md) — technical
design: [technical.md](features/generator-angular/technical.md)

| Done | Issue                                                | Task                                                                          | Description                                                                                                         |
|------|------------------------------------------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| [x]  | [#38](https://github.com/marmotz/kurotako/issues/38) | [38-gen-angular-scaffold](tasks/38-gen-angular-scaffold.md)                   | `package.json`/`tsconfig`, `options.ts`, `errors.ts`, `names.ts`, `zod-artifact.ts` reader, `generator.ts` skeleton |
| [x]  | [#39](https://github.com/marmotz/kurotako/issues/39) | [39-gen-angular-controls-variants](tasks/39-gen-angular-controls-variants.md) | `render/controls.ts` scalar → `FormControl<T>` map + `Create`/`Update` variant field sets                           |
| [x]  | [#40](https://github.com/marmotz/kurotako/issues/40) | [40-gen-angular-reactive-service](tasks/40-gen-angular-reactive-service.md)   | `render/reactive.ts` `@Injectable` factory + `emit/runtime.ts` path-distributed `zodValidator`                      |
| [x]  | [#41](https://github.com/marmotz/kurotako/issues/41) | [41-gen-angular-signal-forms](tasks/41-gen-angular-signal-forms.md)           | `render/signal.ts` `schema` + model factory + `zodTreeValidate` root tree validator                                 |
| [x]  | [#42](https://github.com/marmotz/kurotako/issues/42) | [42-gen-angular-relations-deep](tasks/42-gen-angular-relations-deep.md)       | `render/relations.ts` `relations: 'deep'` nested `FormGroup`/`FormArray`, lazy builders                             |
| [x]  | [#43](https://github.com/marmotz/kurotako/issues/43) | [43-gen-angular-emit-artifact-run](tasks/43-gen-angular-emit-artifact-run.md) | `emit/entity.ts`+`barrel.ts`, `artifact.ts` (`AngularArtifactExtra`), `generate()` wiring + e2e tests               |

## `tako` CLI (`@kurotako/cli`)

[features/cli/overview.md](features/cli/overview.md) — technical design:
[technical.md](features/cli/technical.md) (absorbs the former `tako-watch` feature:
`init` / `generate` / `generate --watch` / `validate`)

| Done | Issue                                                | Task                                                                            | Description                                                                 |
|------|------------------------------------------------------|---------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| [x]  | [#44](https://github.com/marmotz/kurotako/issues/44) | [44-cli-scaffold-reporter-errors](tasks/44-cli-scaffold-reporter-errors.md)     | citty command tree, `ConsoleReporter`, `renderError`, `bin/tako.ts`, barrel |
| [x]  | [#45](https://github.com/marmotz/kurotako/issues/45) | [45-cli-init-command](tasks/45-cli-init-command.md)                             | `tako init` — write `CONFIG_TEMPLATE`, `--force`, refuse-if-exists          |
| [x]  | [#46](https://github.com/marmotz/kurotako/issues/46) | [46-cli-generate-validate-commands](tasks/46-cli-generate-validate-commands.md) | `tako generate` (`--dry-run`) + `tako validate` via `loadAndRun`            |
| [x]  | [#47](https://github.com/marmotz/kurotako/issues/47) | [47-cli-watch-mode](tasks/47-cli-watch-mode.md)                                 | `tako generate --watch` — chokidar loop, debounce, `watchPaths` union       |

## Output modes (directory / npm package)

[features/output-modes/overview.md](features/output-modes/overview.md) — technical design:
[technical.md](features/output-modes/technical.md)

| Done | Issue                                                | Task                                                                          | Description                                                                                            |
|------|------------------------------------------------------|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| [x]  | [#48](https://github.com/marmotz/kurotako/issues/48) | [48-output-root-barrel-and-banner](tasks/48-output-root-barrel-and-banner.md) | `writer/barrel.ts` + `writer/banner.ts`, `run.ts` steps 5b/5c, collision guard (dep of #43)            |
| [x]  | [#49](https://github.com/marmotz/kurotako/issues/49) | [49-output-peers-and-pm](tasks/49-output-peers-and-pm.md)                     | `writer/peers.ts` (peerDeps aggregation) + `writer/pm.ts` (package-manager resolution)                 |
| [x]  | [#50](https://github.com/marmotz/kurotako/issues/50) | [50-output-package-writer](tasks/50-output-package-writer.md)                 | `packageWriter` — `package.json`, tsup build, install; `selectWriter` mode-B branch                    |
| [x]  | [#73](https://github.com/marmotz/kurotako/issues/73) | [73-core-outputs-array](tasks/73-core-outputs-array.md)                       | `outputs[]` amendment — `ResolvedConfig.outputs` / `RunResult.written`, `run.ts` per-output write loop |
| [x]  | [#74](https://github.com/marmotz/kurotako/issues/74) | [74-config-outputs-array](tasks/74-config-outputs-array.md)                   | `outputs[]` amendment — `TakoConfig.outputs`, schema/load cross-field checks, `UnknownGeneratorError`  |

## Drift Guard (`tako check`)

[features/drift-guard/overview.md](features/drift-guard/overview.md) — technical design:
[technical.md](features/drift-guard/technical.md)

| Done | Issue                                                | Task                                                                    | Description                                                                                                  |
|------|------------------------------------------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| [x]  | [#51](https://github.com/marmotz/kurotako/issues/51) | [51-core-writer-plan](tasks/51-core-writer-plan.md)                     | `Writer.plan()` + `PlannedFile`, `directoryWriter.plan()`, `RunOptions/RunResult.plan`, `run.ts` plan branch |
| [x]  | [#52](https://github.com/marmotz/kurotako/issues/52) | [52-output-package-writer-plan](tasks/52-output-package-writer-plan.md) | `packageWriter.plan()` — deterministic subset (src + manifest), no tsup build / no install                   |
| [x]  | [#53](https://github.com/marmotz/kurotako/issues/53) | [53-cli-check-command](tasks/53-cli-check-command.md)                   | `tako check` — `commands/check.ts` + `diff.ts` (`comparePlanToDisk`), citty entry                            |

## Documentation site

[features/docs-site/overview.md](features/docs-site/overview.md) — technical design:
[technical.md](features/docs-site/technical.md)

| Done | Issue                                                | Task                                                                                  | Description                                                                 |
|------|------------------------------------------------------|---------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| [x]  | [#54](https://github.com/marmotz/kurotako/issues/54) | [54-apps-docs-workspace-accommodation](tasks/54-apps-docs-workspace-accommodation.md) | `apps/*` workspace root-file edits (also listed under Monorepo bootstrap)   |
| [x]  | [#55](https://github.com/marmotz/kurotako/issues/55) | [55-docs-site-scaffold](tasks/55-docs-site-scaffold.md)                               | `apps/docs` Docusaurus package: config, sidebar, tsconfig, placeholder page |
| [x]  | [#56](https://github.com/marmotz/kurotako/issues/56) | [56-docs-site-typedoc-api](tasks/56-docs-site-typedoc-api.md)                         | `docusaurus-plugin-typedoc` over ir/core/config/cli, generated `docs/api/`  |
| [x]  | [#57](https://github.com/marmotz/kurotako/issues/57) | [57-docs-site-deploy-workflow](tasks/57-docs-site-deploy-workflow.md)                 | `.github/workflows/docs.yml` + GitHub Pages deploy, `CNAME` / `baseUrl`     |
| [x]  | [#58](https://github.com/marmotz/kurotako/issues/58) | [58-docs-site-v1-content](tasks/58-docs-site-v1-content.md)                           | Minimal content set: getting-started, concepts, `reference/*`               |

## Docs reconciliation (post-MVP)

Cross-cutting cleanup, owned by no single feature: the feature `technical.md` files locked
decisions that now contradict `docs/architecture.md`, `docs/vision.md` and `docs/ir.md`.
Done once the MVP contracts stop moving; not on the critical path.

| Done | Issue                                                | Task                                                                        | Description                                                                                                                                                                    |
|------|------------------------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|      | [#60](https://github.com/marmotz/kurotako/issues/60) | [60-docs-reconciliation-post-mvp](tasks/60-docs-reconciliation-post-mvp.md) | Reconcile `architecture.md` (contracts, hard `zod` dep, output tree, `.ts` config, CLI set), `vision.md` (close the settled open questions), `ir.md` (close the 3 open points) |

## Driver options ergonomics

[features/driver-options-ergonomics/overview.md](features/driver-options-ergonomics/overview.md)
— technical design: [technical.md](features/driver-options-ergonomics/technical.md). Bug:
the config `tako init` writes neither typechecks (`options` typed `undefined` on
schema-bearing drivers) nor runs (`{ use: zodGenerator }` with no `options` →
`driver_options_invalid`).

| Done | Issue                                                | Task                                                                                  | Description                                                                                                   |
|------|------------------------------------------------------|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [x]  | [#69](https://github.com/marmotz/kurotako/issues/69) | [69-config-driver-options-helpers](tasks/69-config-driver-options-helpers.md)         | `@kurotako/config`: `defineParser`/`defineGenerator`, entry option types (Input), `load.ts` `undefined`→`{}`  |
| [x]  | [#70](https://github.com/marmotz/kurotako/issues/70) | [70-migrate-drivers-to-define-helpers](tasks/70-migrate-drivers-to-define-helpers.md) | Migrate `prismaParser` / `zodGenerator` to the helpers + uncommented-`CONFIG_TEMPLATE` compile fixture in cli |

## End-to-end example projects

[features/e2e-examples/overview.md](features/e2e-examples/overview.md) — technical
design: [technical.md](features/e2e-examples/technical.md). Two standalone `examples/`
monorepos (NestJS 11 + Prisma 7 + Angular 22), one per kurotako output mode, exercising
the full pipeline (Prisma parser + Zod/Angular generators) against real consumer code.

| Done | Issue                                                | Task                                                                              | Description                                                                  |
|------|------------------------------------------------------|-----------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| [x]  | [#77](https://github.com/marmotz/kurotako/issues/77) | [77-e2e-examples-root-tooling](tasks/77-e2e-examples-root-tooling.md)             | `.gitignore` / `biome.json` exclusions for `examples/`, `examples/README.md` |
| [x]  | [#78](https://github.com/marmotz/kurotako/issues/78) | [78-e2e-examples-outputdir-scaffold](tasks/78-e2e-examples-outputdir-scaffold.md) | `…-outputdir/` Bun workspace, Prisma schema, `tako.config.ts` (mode A)       |
| [x]  | [#79](https://github.com/marmotz/kurotako/issues/79) | [79-e2e-examples-outputpkg-scaffold](tasks/79-e2e-examples-outputpkg-scaffold.md) | `…-outputpkg/` Bun workspace, Prisma schema, `tako.config.ts` (mode B)       |
| [x]  | [#80](https://github.com/marmotz/kurotako/issues/80) | [80-e2e-examples-outputdir-backend](tasks/80-e2e-examples-outputdir-backend.md)   | NestJS `TasksModule` + `ZodValidationPipe` (outputdir)                       |
| [x]  | [#81](https://github.com/marmotz/kurotako/issues/81) | [81-e2e-examples-outputdir-frontend](tasks/81-e2e-examples-outputdir-frontend.md) | Angular list/create(reactive)/edit(signal) components, flat relations        |
| [x]  | [#82](https://github.com/marmotz/kurotako/issues/82) | [82-e2e-examples-outputpkg-backend](tasks/82-e2e-examples-outputpkg-backend.md)   | NestJS `TasksModule` + `ZodValidationPipe`, consumes `@example/tasks`        |
| [x]  | [#83](https://github.com/marmotz/kurotako/issues/83) | [83-e2e-examples-outputpkg-frontend](tasks/83-e2e-examples-outputpkg-frontend.md) | Angular list/create(reactive)/edit(signal) components, deep relations        |

| Done                                       | Issue | Task | Description |
|--------------------------------------------|-------|------|-------------|
| _no tasks yet — needs `backlog-technical`_ |       |      |             |

## `kurotako` meta-package

[features/meta-package/overview.md](features/meta-package/overview.md) — technical design:
[technical.md](features/meta-package/technical.md). Single published package `kurotako`
(unscoped) that depends on `@kurotako/cli` + `@kurotako/config` and re-exports
`defineConfig`, so a project installs one name and writes
`import { defineConfig } from 'kurotako'`. The parts stay published for advanced use.

| Done | Issue                                                | Task                                                          | Description                                                                        |
|------|------------------------------------------------------|--------------------------------------------------------------|-----------------------------------------------------------------------------------|
| [x]  | [#86](https://github.com/marmotz/kurotako/issues/86) | [86-meta-package-kurotako](tasks/86-meta-package-kurotako.md) | `packages/kurotako` — bin re-exposes `tako` (own `--version`), barrel re-exports `defineConfig`; docs + CI smoke |
| [ ]  | [#94](https://github.com/marmotz/kurotako/issues/94) | [94-tako-init-kurotako-import-surface](tasks/94-tako-init-kurotako-import-surface.md) | `tako init` writes `import { defineConfig } from 'kurotako'`; `reference/*` docs follow (post-merge review follow-up, depends on #90) |

## Running `tako` in a consumer monorepo

[features/monorepo-projects/overview.md](features/monorepo-projects/overview.md) —
technical design: [technical.md](features/monorepo-projects/technical.md). A per-source
**anchor directory** so a parser resolves its own schema-toolchain dependency
(`@prisma/internals`) from where the source's schema lives, not from the `tako.config.ts`
directory; plus a monorepo-aware `tako init`.

| Done | Issue                                                | Task                                                                                                  | Description                                                                       |
|------|------------------------------------------------------|------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| [x]  | [#89](https://github.com/marmotz/kurotako/issues/89) | [89-core-parse-context-anchor-dir](tasks/89-core-parse-context-anchor-dir.md)                         | core: `ParseContext.anchorDir`, `Parser.anchor` hook, `run()` wiring              |
| [x]  | [#90](https://github.com/marmotz/kurotako/issues/90) | [90-cli-tako-init-monorepo](tasks/90-cli-tako-init-monorepo.md)                                       | `tako init --monorepo` + auto-detection + `CONFIG_TEMPLATE_MONOREPO`              |
| [x]  | [#91](https://github.com/marmotz/kurotako/issues/91) | [91-config-parser-anchor-currying](tasks/91-config-parser-anchor-currying.md)                         | `@kurotako/config`: `TakoParser.anchor`, `defineParser`, currying in `load.ts`    |
| [x]  | [#92](https://github.com/marmotz/kurotako/issues/92) | [92-parser-prisma-anchor-internals-resolution](tasks/92-parser-prisma-anchor-internals-resolution.md) | parser-prisma: `anchor` impl + resolve `@prisma/internals` from the schema dir    |
| [x]  | [#93](https://github.com/marmotz/kurotako/issues/93) | [93-docs-monorepo-usage-and-example](tasks/93-docs-monorepo-usage-and-example.md)                     | docs "monorepo usage" page + move `@prisma/internals` into the example sub-project |
