# `tako` CLI (`@kurotako/cli`)

**Status**: technical design — [technical.md](technical.md)

## Context

The user entry point. Orchestrates the pipeline through `@kurotako/core` against a real
project. The brief favors a standalone CLI rather than hooking into `prisma generate`, to
stay source-agnostic.

During development the schema or the config changes often and re-running `tako generate` by
hand is tedious, so a watch mode belongs to the same entry point. The former `tako-watch`
feature is folded into this one.

## Goal

A `tako` binary that loads `tako.config.ts`, runs the pipeline with readable output and
correct exit codes, and can keep watching the inputs to regenerate on change.

## Decisions made

### Command set (v1)

- `tako init` — writes the fixed commented `tako.config.ts` skeleton, refuses to overwrite
  an existing file. Behaviour owned by
  [config-system](../config-system/overview.md#tako-init).
- `tako generate` — loads and resolves the config, runs the full pipeline, writes the
  output. Supports `--dry-run` (from [core-pipeline](../core-pipeline/overview.md), no
  filesystem writes) and `--config <path>`.
- `tako generate --watch` — watches the schema input files and `tako.config.ts`, and
  re-runs the **whole** pipeline on change (debounced). No incremental regeneration in v1,
  consistent with core-pipeline's "full regeneration on every run". Fine-grained
  invalidation at the `(namespace, generator)` grain is a later evolution (see open
  questions).
- `tako validate` — loads and validates the config and the resulting IR, reports issues,
  writes nothing. Same checks as `generate` up to (not including) emission.
- No `list-drivers`: drivers are imported directly in `tako.config.ts`, there is no
  registry to enumerate.

### CLI library

- **citty**. Lightweight, typed, sub-commands and auto-help; same UnJS ecosystem as `jiti`
  already chosen by [config-system](../config-system/overview.md) for config loading.

### Console output

- **Minimal by default**: one line per phase (config loaded, parsing, generating,
  writing), a short total at the end (files written / updated / removed count). No
  `--verbose` or `--json` in v1.
- Errors reported by the core are printed with the offending source or generator
  identified, then the process exits non-zero (fail-fast, from
  [core-pipeline](../core-pipeline/overview.md)). Watch mode reports the error and keeps
  watching instead of exiting.

### Exit codes

- `0` success, non-zero on any error (config invalid, IR invalid, driver failure, path
  collision). Watch mode only exits non-zero on an unrecoverable startup error.

### Out of scope for v1

- **`prisma generate` integration.** The brief explicitly favours a standalone
  source-agnostic CLI. A `generator` block in `schema.prisma` that shells out to `tako`
  stays possible later, without `tako` ever depending on the Prisma ecosystem.
- Incremental / cached regeneration (only full re-run under `--watch`).
- `--verbose` / `--json` output.
- **`tako check`** (drift guard). A post-v1 fast-follow that adds a `check` subcommand
  reusing the `generate` pipeline up to emission — see
  [drift-guard](../drift-guard/overview.md).

## Settled in technical.md

- CLI framework **citty**; file watching **chokidar v4**.
- Commands `init` / `generate` (+ `--watch`, `--dry-run`) / `validate`, global `--config`.
  `validate` = `generate --dry-run` minus the "would be written" line.
- Watch discovers schema files via an **optional `watchPaths?()` method on the driver
  contract**, curried by `@kurotako/config` like `parse`. Additive change to
  `@kurotako/core` (`Parser`), `@kurotako/config` (`TakoParser`) and `parser-prisma`.
- `ConsoleReporter implements @kurotako/core Logger`; minimal output on stderr, one line
  per phase + summary. Single `TakoError` catch -> `error [code]: …` + exit 1.

## Open questions

- Later evolution: `(namespace, generator)`-grain incremental regeneration driven by the
  `dependsOn` DAG.

## Depends on

- [core-pipeline](../core-pipeline/overview.md), [config-system](../config-system/overview.md).
- Useful as soon as a parser and a generator exist ([parser-prisma](../parser-prisma/overview.md),
  [generator-zod](../generator-zod/overview.md)).
- Downstream: [docs-site](../docs-site/overview.md) documents the CLI surface and its
  version selector tracks `@kurotako/cli` releases.
