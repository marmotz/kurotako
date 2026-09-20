# Implicit generator dependencies

**Status**: technical design in [technical.md](technical.md)

## Context

Today a generator's hard dependency must be declared by the user: `gen-angular` has
`dependsOn: ['zod']`, and core rejects a config with no entry named `zod`
([docs/architecture.md](../../../docs/architecture.md)). A project that only wants Angular
or React forms must still list `gen-zod` even though it never uses Zod directly, and the
user's `gen-zod` options (for example `zodVersion`) silently shape what the dependent
generator consumes.

The need surfaced while designing
[generator-react-tanstack](../generator-react-tanstack/overview.md): Ekoz renames its Zod
entry (`zod-api`) and wraps it to rewrite the emitted path segment, and the wrapper leaves
the artifact module specifiers pointing at the old `zod/` segment. This feature exists to
remove that whole class of problem.

## Goal

A generator declares the dependency it needs **together with the configuration it needs
from it**, and `tako` instantiates that dependency itself, privately, for that generator.
A project uses `gen-angular` or `gen-react-tanstack` without configuring `gen-zod`, and
the dependent's behaviour no longer depends on how (or whether) the user configured the
dependency's own entry.

## Decisions made

- **Contract: driver descriptor.** A generator's `dependsOn` carries a descriptor
  (driver plus fixed options) instead of a name. The dependent package therefore has the
  dependency package as a runtime dependency, not only a peer.
- **Replaces name-based `dependsOn` entirely.** The by-name form (`dependsOn: ['zod']`,
  "absent from the config => core rejects") is removed, a breaking change accepted in
  `0.x`. `gen-angular` and `gen-react-tanstack` move to the descriptor; the interim
  `zod` option of `gen-react-tanstack` disappears.
- **Always a private instance, one per dependent.** Even without any user entry, and
  even when the user declares the same generator (for example `zod`), the dependent gets
  its own instance. Two active dependents (`angular` and `react-tanstack`) each embed their
  own copy; the cost (duplicated code on disk, structurally equal but distinct types
  across copies) is accepted for full isolation.
- **Options are owned by the dependent.** The dependent's driver fixes the descriptor's
  options; the user has no knob on the private instance. Some may be derived from the
  dependent's own options, decided at technical design.
- **Output lives under the dependent's sub-tree**: `<namespace>/angular/zod/...`. The
  dependent owns its whole tree, artifact module specifiers stay coherent with the emitted
  paths, and nothing collides with a user-declared `<namespace>/zod/`. This is what makes
  the Ekoz `zod-api` wrapper unnecessary.
- **Namespaces**: a private instance runs on exactly the namespaces of its dependent
  (subsumes the earlier "union of dependents' namespaces" idea, since instances are not
  shared).
- **In scope for this feature**: the Ekoz case (renamed or second Zod instance with a
  consistent segment and specifiers) is the reason the feature exists, not a follow-up.
- **Invisible instance.** A private instance is not a graph node nor a config key; it is
  part of its dependent. `outputs[].generators: ['angular']` includes it automatically,
  and the synthesized root barrel does not re-export it (no name collision with a
  user-declared `zod`, no ambiguity warning). It stays reachable by subpath.
- **Artifact access unchanged.** The dependent reads the private artifact through
  `ctx.dependencies`, keyed by the dependency driver's name (`ctx.dependencies.zod`); no
  collision is possible since the instance is private.
- **`optionalDependsOn` is removed**, together with name-based `dependsOn` (nothing in the
  repo uses it). The contract keeps a single dependency form: the descriptor.
- **Mode B.** The private instance's code sits in the dependent's sub-tree, so it ships in
  the same per-namespace package; its `peerDependencies` (for example `zod`) are merged
  into the dependent's in the existing aggregation. No extra package.
- **Migration.** A name-based `dependsOn` or an `optionalDependsOn` is rejected at config
  load with an explicit message pointing to the descriptor form. Ships with a breaking
  changeset (minor in `0.x`) and a migration note in the docs.

- **The DAG disappears.** With no name-based edge left, generators run in declaration
  order; the topological sort and its three dependency errors are removed. This replaces
  the locked "generators form a DAG via `dependsOn`" decision (docs and `AGENTS.md` follow).
- **`dependsOn` is an array or a function of the dependent's options**, so the frozen
  options of a private instance can be derived from them (absorbs issue #197).
- **Segment is passed by core** (`ctx.segment`): the dependency builds its file paths and
  artifact module specifiers from it.
- **Sequencing**: this feature ships before `gen-react-tanstack`, which is built directly
  on the descriptor (no interim `zod` option, #197 dropped).

## Open questions

None at product level. `tako check` and `tako validate` are covered by the aggregate run
(see [technical.md](technical.md)).

## Depends on

- [core-pipeline](../../_archives/features/core-pipeline/overview.md),
  [config-system](../../_archives/features/config-system/overview.md).

## Feature order

Follows [generator-react-tanstack](../generator-react-tanstack/overview.md), which ships
first with an interim `zod` option naming the Zod entry; this feature then removes that
option.
