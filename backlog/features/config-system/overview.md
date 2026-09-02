# Configuration system

**Status**: technical design — [technical.md](technical.md)

## Context

The user must declare their sources (parsers + options + namespace), their generators
(+ options + optional namespace restriction), and the output mode. The choice of format
drives ergonomics and the ability to plug in programmable drivers. The core needs a
single, typed, well-diagnosed way to load and validate this declaration.

## Goal

A documented config format, resolved and validated by the core, with editor typing and
useful runtime error messages. A `tako init` command drops a commented skeleton.

## Decisions made

### Format

- **`tako.config.ts` only in v1.** No YAML, no JSON. Drivers are imported in the file and
  passed as instances/objects; the core never resolves a package by short name and never
  installs anything. Consistent with
  [core-pipeline](../core-pipeline/overview.md) ("driver resolution").
- **Entry point**: `export default defineConfig({ ... })`. `defineConfig` is a helper
  (exact package -> `technical.md`); it returns its input unchanged and only carries the
  types. Per-driver options are typed by the driver's generic at the call site.
- **File resolution**: fixed name `tako.config.ts`, looked up from the current working
  directory then walking up to the repository root. `--config <path>` overrides.
- **Runtime loading**: a dedicated loader (e.g. `jiti`) transpiles the `.ts` on the fly
  and resolves its driver imports. Owned by [cli](../cli/overview.md); adds one
  dependency there rather than constraining the config to erasable TS.

### Sections

- `sources` — keyed object; **each key is a namespace**
  ([ADR-0003](../../../docs/adr/0003-multiple-parsers-namespaces.md)). Value carries the
  parser instance and its options.
- `generators` — an **array of entries**; each entry carries the generator instance
  (`use`), its `options?`, and an optional `namespaces?` allowlist restricting the IR
  view it receives (default = full IR; filtering done by the core —
  [core-pipeline](../core-pipeline/overview.md)). Order in the array is irrelevant (the
  core resolves the DAG). config-system resolves this array into the
  `ResolvedConfig.generators` shape core-pipeline `#15` declares (keyed by the
  generator short name; one entry per generator in v1).
- `output` — mode A `{ dir }` (default) vs mode B
  `{ mode: 'package', packagesDir, scope }` ([ADR-0005](../../../docs/adr/0005-output-modes.md)).
- Optional top-level extension callbacks (`afterEmit`, ...) — exact set owned by
  [core-pipeline](../core-pipeline/overview.md) `technical.md`.

### Validation

- **Valibot**, shared across the stack. The core validates the resolved config with a
  Valibot schema and reports located, readable issues. This is the same validation
  library now adopted by [ir-model](../ir-model/overview.md); the project standardises on
  one validation library instead of hand-rolling equivalents.
- **Per-driver options**: a parser or generator **may** expose a Valibot options schema.
  When present, the core validates that entry's options block against it at load time;
  when absent, the core only checks the `options` field is an object or missing. Errors
  are reported the same way whether or not TypeScript was bypassed.

### No per-environment config

- **One config file, no env-conditional generation.** Generated code must be
  deterministic and identical across environments so it can be committed and tested once.
  The `.ts` file may still read `process.env`, but conditioning the generated output on
  the environment is out of scope and discouraged.

### `tako init`

- **Fixed commented skeleton only.** No interactive prompts, no auto-detection of an
  existing `schema.prisma`. Writes `tako.config.ts` with commented `sources` /
  `generators` / `output` stubs and refuses to overwrite an existing file.

## Settled in technical.md

- New package **`@kurotako/config`** owns `defineConfig`, the Valibot structural schema,
  file resolution and `loadConfig()` (builds the `ResolvedConfig` core consumes).
- Driver contract: `TakoParser<O>` / `TakoGenerator<O>` **objects** with an optional
  Valibot `optionsSchema` and `parse(ctx, options)` / `generate(ctx, options)`;
  `@kurotako/config` validates `options` and curries the argument away so
  `@kurotako/core` is unchanged.
- Loader: **`jiti`**. Auto-lookup walks up for `tako.config.ts`, stops at `.git`.
- Hooks: top-level `hooks: { afterEmit }`, passed through to `ResolvedConfig.hooks`
  (single hook, owned by [core-pipeline](../core-pipeline/overview.md)).
- Requires two additive upstream changes (see technical.md "Consequences"):
  `ResolvedConfig.rootDir` in core-pipeline `#15`, a 7th skeleton in monorepo-bootstrap `#6`.

## Depends on

- [core-pipeline](../core-pipeline/overview.md), [ir-model](../ir-model/overview.md).
- The chosen format impacts [cli](../cli/overview.md) and every driver.
- Downstream: [docs-site](../docs-site/overview.md) publishes the `tako.config` reference.
