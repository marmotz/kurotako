# backend — core types, driver contracts and error model

**Status**: to do **Type**: backend **Issue**: [#15](https://github.com/marmotz/kurotako/issues/15)

Reference: [../features/core-pipeline/technical.md §Public API (`run.ts` + `types.ts`)](../features/core-pipeline/technical.md#public-api-runts--typests)
and [§Error model (`errors.ts`)](../features/core-pipeline/technical.md#error-model-errorsts).

## Verified

- `packages/core/` is scaffolded by [#6](6-package-skeletons.md) with a placeholder
  `src/index.ts` (`export const version`) and one trivial test. This task replaces the
  placeholder with the real type + error skeleton.
- `@kurotako/core` gains a `@kurotako/ir` `workspace:*` runtime dependency and a
  `../ir` project reference in `packages/core/tsconfig.json` (already mandated by
  [#6](6-package-skeletons.md) step 2 for imported internal packages). The only other
  runtime dependency is `tsup`, added later by
  [output-modes](../features/output-modes/technical.md) and loaded lazily on the mode-B
  path only (`#20` / `#21` scope stays `@kurotako/ir`-only). No `Bun.*` API.

## To do

1. `packages/core/src/types.ts` — every public type from the technical design, runtime
   code free:
   - `ResolvedConfig` (incl. `rootDir: string` — absolute config-file dir, used as
     `ParseContext.cwd`), `SourceConfig`, `GeneratorConfig`, `OutputConfig` (incl.
     `packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'` — mode B, consumed by
     [output-modes](../features/output-modes/technical.md)).
   - `Parser` (incl. the optional `watchPaths?(ctx: ParseContext): string[] |
     Promise<string[]>` member — metadata for `cli --watch`, `run()` never calls it),
     `ParseContext`, `Generator`, `GenerateContext`, `GenOutput`, `VirtualFile` (its
     `path` prefix is `<namespace>/<generatorName>/` — one sub-tree per generator).
   - `GeneratorArtifact` (incl. `peerDependencies?: Record<string, string>` — package →
     semver range the emitted code imports; core aggregates it per namespace in mode B),
     `EntitySymbols`.
   - `Hooks`, `AfterEmitContext`.
   - `Logger`.
   - `RunOptions`, `RunResult`.
   - `Generator` keeps the two flat arrays `dependsOn?` / `optionalDependsOn?` (no tagged
     union). Contexts stay minimal — no `options` field on `ParseContext` /
     `GenerateContext` (`@kurotako/config` curries driver options into the closure).
2. `packages/core/src/errors.ts`:
   - `class TakoError extends Error { readonly code: string }`.
   - Subclasses from the error table: `NamespaceMismatchError`, `IrValidationError`
     (carries `IrIssue[]` + `namespace`), `DuplicateNamespaceError`,
     `UnknownDependencyError`, `DependencyCycleError`, `OutputCollisionError`,
     `InvalidOutputPathError`, `UnsupportedOutputModeError`, `DriverError`
     (wraps `cause`, tags `role` + `name` [+ `namespace`]), `HookError`.
   - Mode-B error classes (consumed by [output-modes](../features/output-modes/technical.md),
     defined here so the CLI's single `TakoError` catch covers them):
     `OutputPeerConflictError` (`output_peer_conflict`, tags `namespace` / `package` /
     `ranges` / `generators`), `PackageBuildError` (`package_build_error`, wraps `cause`,
     tags `namespace`), `PackageInstallError` (`package_install_error`, wraps `cause`,
     tags `pm`).
   - Each sets a stable `code` string as per the table.
3. `packages/core/src/logger.ts` — a no-op `Logger` default and a `childLogger(base,
   prefixMeta)` wrapper that merges a `{ namespace }` / `{ generator }` tag into `meta`.
4. `packages/core/src/index.ts` — barrel re-exporting `types.ts`, `errors.ts`, and (later)
   `run`. Drop the placeholder `version` const. Set `"sideEffects": false` in
   `packages/core/package.json`. Add `@kurotako/ir` to `dependencies`.
5. Add the `../ir` reference to `packages/core/tsconfig.json`.
6. `packages/core/src/errors.test.ts` — each subclass carries the right `code`,
   `instanceof TakoError`, and preserves `cause` where set.
7. `bun run typecheck`, `bun run test`, `bun run build` green for the package.

## Dependencies

- [#6](6-package-skeletons.md)
- [#11](11-ir-types-and-version.md)
