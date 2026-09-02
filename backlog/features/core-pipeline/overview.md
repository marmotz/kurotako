# Orchestration (`@kurotako/core`)

**Status**: technical design — [technical.md](technical.md)

## Context

Once the IR and the driver contracts are defined, we need the piece that runs the
pipeline: load the config, instantiate the parsers, merge the partial IRs, resolve the
generator order, run them, collect the artifacts and write the output.

## Goal

A `@kurotako/core` package that, from a resolved config, produces the complete output,
with clear errors (duplicate namespace, missing dependency, cycle, driver not found).

## Decisions made

### Roles and graph

- Two roles: `parser` and `generator` ([ADR-0006](../../../docs/adr/0006-parser-generator-vocabulary.md)).
- Generators form a DAG via `dependsOn`, topological order computed by the core
  ([ADR-0002](../../../docs/adr/0002-no-middle-generators-dag.md)).
- Partial IRs merged keyed by namespace; rejected if two sources share a key
  ([ADR-0004](../../../docs/adr/0004-ir-namespace-first.md)).
- Missing hard dependency -> error; optional dependency -> the generator adapts.
- The core enforces IR-version compatibility: a parser/generator declaring an
  incompatible `irVersion` is rejected (see [ir-model](../ir-model/overview.md)).

### Driver resolution

- Drivers are **imported directly in `tako.config.ts`** and passed as instances/objects.
  The core never resolves a package by short name and never installs anything. Options
  are typed by TypeScript at the call site. Consistent with `config-system` leaning `.ts`.

### IR passed to generators

- A generator receives an **IR view filtered by namespace**: the config may restrict a
  generator to a subset of namespaces and the core passes it the filtered IR. Default
  (no restriction) = the full global IR. Traversal via `@kurotako/ir` helpers.
- The exact config shape for the restriction is settled in
  [config-system](../config-system/overview.md).

### Artifact exchange between generators (`dependsOn` contract)

- Each generator returns, alongside its files, a **structured typed manifest**: per
  entity, the exported symbols (e.g. `UserDto`, `UserSchema`) and the module specifier to
  import them from. Dependents consume this manifest, never raw file paths. This decouples
  generators from each other's output tree. Exact manifest type -> `technical.md`.

### File writing

- Generators return a **virtual file tree** (`path -> content`); they do not touch the
  filesystem. The core aggregates every generator's tree, rejects path collisions between
  generators, then writes everything in a single pass. Enables `--dry-run`, a clean diff,
  atomic output, and one single place that performs I/O.

### Output directory

- `tako` is the **exclusive owner** of its output directory: it is wiped and fully
  regenerated on every run. The config must point it at a dedicated generated directory.

### Execution model

- **Full regeneration on every run** in v1: parse everything, generate everything, write
  everything. No cache, no incremental. Watch / incremental lives in the
  [cli](../cli/overview.md) feature.
- **Fail-fast** error handling: the first error (duplicate namespace, missing dependency,
  cycle, invalid IR, driver throwing) stops the run with a message identifying the
  offending source or generator.
- **Minimal hooks** in v1: the `.ts` config may expose a few extension callbacks
  (e.g. `afterGenerate` to run a formatter). Exact hook set and signatures -> `technical.md`.

## Open questions

- Exact `parser` / `generator` contract signatures and the contents of `ParseContext` /
  `GenerateContext` -> `technical.md`.
- Exact shape of the artifact manifest type and how a dependent reads it -> `technical.md`.
- Exact set of v1 hooks and their signatures -> `technical.md`.
- Whether the unconditional output wipe needs a guard (refuse a non-empty directory that
  has no prior-run marker, refuse a path outside the project) -> `technical.md`.

## Depends on

- [ir-model](../ir-model/overview.md), [monorepo-bootstrap](../monorepo-bootstrap/overview.md).
- Interacts heavily with [config-system](../config-system/overview.md) (driver instances,
  namespace filtering, hook callbacks all live in the config).
