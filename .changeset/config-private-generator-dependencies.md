---
'@kurotako/config': minor
---

`dependsOn` on a generator driver is now a list of private generator descriptors,
`{ use: <driver>, options?: … }` (a config entry without `namespaces`), instead of
driver names; `optionalDependsOn` is removed. `dependsOn` also accepts a function
receiving the generator's validated options, so a dependency's options can derive
from them. `defineGenerator` type-checks each descriptor's `options` against the
dependency's own `optionsSchema` (new exported types `GeneratorDependency`,
`DependencyList`, `DependencyShape`, `GeneratorDriverBase`).

`loadConfig` validates and curries the whole dependency chain. New errors:
`DuplicateDependencyError`, `DependencyCycleError` (moved from `@kurotako/core`,
same code `dependency_cycle`, only reachable through the function form) and
`LegacyDependencyError` (a string entry in `dependsOn`, or an `optionalDependsOn`
key, pointing at the descriptor form). `DriverOptionsError` gains an optional `via`
naming the dependent of an invalid private dependency.

Migration: replace `dependsOn: ['zod']` with
`dependsOn: [{ use: zodGenerator, options: { zodVersion: 4 } }]`, and drop
`optionalDependsOn`.
