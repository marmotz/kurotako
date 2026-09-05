---
title: CLI (tako)
sidebar_position: 2
---

# CLI reference

The `@kurotako/cli` package installs the `tako` binary. Run it with your package
runner (`npx tako …`, `bunx tako …`, `pnpm exec tako …`).

```text
tako                       print help
tako --version | -v        print the CLI version
tako --help | -h           usage (works per sub-command too)
tako init      [--config <path>] [--force]
tako generate  [--config <path>] [--watch] [--dry-run]
tako validate  [--config <path>]
tako check     [--config <path>]
```

## Global option

| Flag | Meaning |
|---|---|
| `--config <path>` | path to the config file; forwarded to `loadConfig`. Default: `./tako.config.ts` resolved by walking up from the current directory. |

## `tako init`

Writes a commented `tako.config.ts`.

- Always targets the **current directory** (it does not walk up). `--config <path>`
  overrides the target path.
- Refuses to overwrite an existing file. `--force` replaces it.
- No prompts, no schema auto-detection.

## `tako generate`

Runs the full pipeline: `loadConfig` → parse each source → merge and validate the IR →
resolve the generator DAG → run every generator → write the files → run `hooks.afterEmit`.

| Flag | Effect |
|---|---|
| `--watch` | stay running; regenerate on every config or watched schema change. A failed cycle is reported and watching continues. |
| `--dry-run` | run every check and report how many files *would* be written; nothing is written and `afterEmit` is skipped. |

Fail-fast: the first error stops the run (except under `--watch`, which keeps going).

## `tako validate`

The same checks as `generate` up to — but not including — emission. Exercises parsing,
IR validation, the generator DAG and every `generate()` call, then stops before the
writer. Prints `config and schema are valid` and exits `0`, or exits `1` on the first
`TakoError`. This is the CI-facing verb.

## `tako check`

Drift guard. Runs the pipeline in plan mode (no writes, no `afterEmit`), then compares
the planned output against what is on disk. Exit `0` when they match, exit `1` on any
drift. Use it in CI to catch a committed `generated/` tree that is out of date with the
schema.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | success |
| `1` | a `TakoError` (config, parse, generate, write) or, for `check`, detected drift |

## Programmatic use

`@kurotako/cli` also exports `runCli(argv)` and the reporter / error helpers for
embedding the CLI in a script or a test. See the
[`@kurotako/cli` API reference](../api/).
