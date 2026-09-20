---
'@kurotako/core': minor
---

Generators no longer form a name-based DAG. `Generator.dependsOn` now holds
already-curried generators (private instances) and `optionalDependsOn` is removed.
`run()` executes generators in declaration order (`RunResult.order` keeps the
field); each private dependency runs first, for its dependent alone, on the same
namespace-filtered IR and into the nested sub-tree `<namespace>/<segment>/<dep>/`.
Its artifact arrives as `ctx.dependencies[<dep>]`, its files join the dependent's
tree (so `outputs[].generators` keeps them and the root barrel does not re-export
them), its `peerDependencies` are merged into the dependent's artifact, and it never
appears in `RunResult.artifacts`.

New public surface: `GenerateContext.segment` (required: the sub-tree a generator
emits into and builds module specifiers from; `generator.name` at the top level,
`<parent>/<dep>` for a private instance), `SegmentViolationError` (code
`segment_violation`, a private instance emitted outside its segment),
`DriverError.dependencyOf`, and `OutputPeerConflictError.dependent` (its `namespace`
is now optional).

Removed: `generatorOrder`, `UnknownDependencyError`, `InvalidDependencyError` and
`DependencyCycleError` (the latter moved to `@kurotako/config`).

Migration: a third-party generator that read `ctx.dependencies.<name>` for a
sibling config entry must now declare that dependency as a descriptor (see
`@kurotako/config`); a generator used as a dependency must build its paths and
module specifiers from `ctx.segment`.
