# Docs — docs site v1 content set

**Status**: done **Type**: docs **Issue**: [#58](https://github.com/marmotz/kurotako/issues/58)

Reference: [../features/docs-site/technical.md §Content architecture](../features/docs-site/technical.md#content-architecture).

## Verified state

The scaffold task ships `apps/docs` with a placeholder landing page and an empty manual
sidebar structure; the TypeDoc task fills `docs/api/`. This task writes the hand-authored
minimal content set (overview scope). It depends on the documented features being stable:
the `tako` CLI commands ([cli/technical.md](../features/cli/technical.md)), the
`tako.config.ts` shape ([config-system/technical.md](../features/config-system/technical.md))
and the output modes ([output-modes/technical.md](../features/output-modes/technical.md)).

## À faire

1. `apps/docs/docs/getting-started/quick-start.md` — install `tako`, `tako init`, first
   `tako generate`, where the output lands. Based on
   [cli/technical.md §Command surface](https://github.com/marmotz/kurotako/blob/main/backlog/features/cli/technical.md#command-surface-clits).
2. `apps/docs/docs/getting-started/installation.md` — Node >= 24, Bun/npm, adding a
   parser and a generator package, the `@kurotako/*` scope.
3. `apps/docs/docs/concepts/` — `parsers-and-generators.md`,
   `intermediate-representation.md`, `dependency-graph.md`, `namespaces.md`. Rewritten
   user-facing prose; **do not** transclude
   [docs/architecture.md](https://github.com/marmotz/kurotako/blob/main/docs/architecture.md)
   or [docs/glossary.md](https://github.com/marmotz/kurotako/blob/main/docs/glossary.md).
   Link to [docs/architecture.md](https://github.com/marmotz/kurotako/blob/main/docs/architecture.md)
   on GitHub for rationale. Use `parser` / `generator` vocabulary only (see
   [docs/glossary.md](https://github.com/marmotz/kurotako/blob/main/docs/glossary.md));
   no "driver".
4. `apps/docs/docs/reference/tako-config.md` — full `tako.config.ts` reference:
   `defineConfig`, `parsers` map (config key = namespace), `generators` array,
   `dependsOn` / `optionalDependsOn`, `output` (`mode` / `dir` / `packagesDir` / `scope`),
   `hooks.afterEmit`. Mirror `TakoConfigSchema` from
   [config-system/technical.md](https://github.com/marmotz/kurotako/blob/main/backlog/features/config-system/technical.md).
5. `apps/docs/docs/reference/cli.md` — `tako init | generate | validate`, the `--config`
   / `--watch` / `--dry-run` flags.
6. `apps/docs/docs/reference/catalog.md` — the available parsers (`parser-prisma`) and
   generators (`gen-zod`, `gen-angular`), each linking to its package README / options.
7. `apps/docs/docs/reference/output-modes.md` — mode A (directory, default) vs mode B
   (npm package per source), from
   [output-modes/technical.md](https://github.com/marmotz/kurotako/blob/main/backlog/features/output-modes/technical.md)
   and [docs/architecture.md](https://github.com/marmotz/kurotako/blob/main/docs/architecture.md).
8. Replace the scaffold placeholder landing page with a real intro; finalise
   `sidebars.ts` ordering (getting-started -> concepts -> reference -> API).
9. The "writing a parser / generator" guides are **out of scope** (fast-follow with the
   future `plugin-kit` feature).
10. Verify `bun run --filter '@kurotako/docs' build` passes with no broken-link warnings.

## Dependencies

- [55-docs-site-scaffold](55-docs-site-scaffold.md) — the `apps/docs` package.
- [56-docs-site-typedoc-api](56-docs-site-typedoc-api.md) — API section + final sidebar
  shape.
- [#46](46-cli-generate-validate-commands.md) — `tako generate` / `tako validate`.
- [#47](47-cli-watch-mode.md) — `tako generate --watch`.
- [#25](25-config-load.md) — the resolved `tako.config` behaviour.
- [#50](50-output-package-writer.md) — mode B fully implemented.
