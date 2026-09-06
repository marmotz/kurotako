# backend — @kurotako/config type surface, defineConfig, errors, template

**Status**: done
**Type**: backend
**Issue**: [#22](https://github.com/marmotz/kurotako/issues/22)

Reference: [../features/config-system/technical.md §Config shape and `defineConfig`](../features/config-system/technical.md#config-shape-and-defineconfig-typests--definets),
[§`tako init` template](../features/config-system/technical.md#tako-init-template-templatets),
[§Errors](../features/config-system/technical.md#errors-errorsts).

## Verified

- `packages/config/` is the seventh skeleton scaffolded by
  [#6](6-package-skeletons.md) (`export const version` placeholder + one trivial test).
  This task replaces the placeholder with the real type + error + template skeleton.
- Upstream types already designed: `@kurotako/core` `#15` provides `ParseContext`,
  `GenerateContext`, `GenOutput`, `AfterEmitContext`, `ResolvedConfig` and the `TakoError`
  base; `@kurotako/ir` `#11` provides `SourceIR`.
- `@kurotako/config` deps (technical.md §Package): `@kurotako/core` as
  **`peerDependencies` + `devDependencies`** (peer dependency policy —
  [monorepo-bootstrap/technical.md](../features/monorepo-bootstrap/technical.md#peer-dependency-policy);
  `config` and the CLI must share one `TakoError` instance); `@kurotako/ir` (`workspace:*`
  `dependencies`), `valibot`, `jiti` as `dependencies`. No `Bun.*` API; runs on Node and Bun.

## To do

1. `packages/config/package.json` — `peerDependencies` + `devDependencies`:
   `@kurotako/core` (`workspace:*`). `dependencies`: `@kurotako/ir` (`workspace:*`),
   `valibot`, `jiti`. Keep `"sideEffects": false`.
2. `packages/config/tsconfig.json` — `references: [{ "path": "../core" }, { "path": "../ir" }]`.
3. `packages/config/src/types.ts` — hand-authored (technical.md is the source):
   `TakoParser<O>` (with `optionsSchema?: v.GenericSchema<unknown, O>`, `parse(ctx, options)`
   and the optional `watchPaths?(ctx, options): string[] | Promise<string[]>`),
   `TakoGenerator<O>`, `OptionsOf<D>`, `SourceEntry<D>`,
   `GeneratorEntry<D>` (`use` / `options?` / `namespaces?`), `OutputOption` (incl.
   `packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'` — mode B, consumed by
   [output-modes](../features/output-modes/technical.md)), `TakoHooks`
   (`afterEmit?`), `TakoConfig`. Type-only imports from `@kurotako/core` / `@kurotako/ir`
   and `import type * as v from 'valibot'`.
4. `packages/config/src/define.ts` — `export function defineConfig<const C extends TakoConfig>(config: C): C`
   returning `config` unchanged (identity; only binds the generic for editor inference).
5. `packages/config/src/errors.ts` — `ConfigNotFoundError`, `ConfigLoadError`,
   `NoDefaultExportError`, `ConfigShapeError`, `DuplicateGeneratorError`,
   `UnknownNamespaceError`, `DriverOptionsError`, each `extends TakoError` from
   `@kurotako/core` with the stable `code` from the error table. The carrying ones expose
   `issues: { path: string; message: string }[]` (same convention as core's
   `IrValidationError`); `ConfigLoadError` preserves `cause`; `DriverOptionsError` tags
   `role` / `name` / `namespace?`.
6. `packages/config/src/template.ts` — `export const CONFIG_TEMPLATE: string`, the
   commented `tako.config.ts` from technical.md §template (imports `defineConfig` from
   `@kurotako/config`, commented driver imports, empty `sources` / `generators`,
   `output: { dir: './generated/kurotako' }`).
7. `packages/config/src/index.ts` — barrel re-exporting `types.ts`, `define.ts`,
   `errors.ts`, `template.ts` (drop the placeholder `version` const). `loadConfig` /
   `resolveConfigFile` are added to the barrel by their own tasks.
8. Tests (colocated vitest):
   - `errors.test.ts` — each subclass `instanceof TakoError`, right `code`, `cause`
     preserved where set.
   - `define.test.ts` — `defineConfig(x)` returns `x` (identity).
   - `define.test-d.ts` — `options` is inferred from `use.optionsSchema`; a driver with
     no `optionsSchema` makes a passed `options` a type error.
   - `template.test.ts` — `CONFIG_TEMPLATE` is non-empty and, evaluated, exposes a
     default export of the expected shape (full `TakoConfigSchema` check lives in the
     schema task).
9. `bun run typecheck`, `bun run test`, `bun run build` green for the package.

## Dependencies

- [6-package-skeletons](6-package-skeletons.md)
- [11-ir-types-and-version](11-ir-types-and-version.md)
- [15-core-types-and-contracts](15-core-types-and-contracts.md)
