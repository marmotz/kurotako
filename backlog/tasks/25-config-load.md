# backend — @kurotako/config loadConfig (jiti import + validate + build ResolvedConfig)

**Status**: to do
**Type**: backend
**Issue**: [#25](https://github.com/marmotz/kurotako/issues/25)

Reference: [../features/config-system/technical.md §Loading and building `ResolvedConfig` (`load.ts`)](../features/config-system/technical.md#loading-and-building-resolvedconfig-loadts).

## Verified

- `ResolvedConfig` (from `@kurotako/core` `#15`) now carries `rootDir: string`; `run.ts`
  (`#21`) reads it as `ParseContext.cwd`. `loadConfig` is what sets it.
- Decided: loader is `jiti`; driver options validated per entry against
  `use.optionsSchema` then **curried away** so core gets a plain `Parser` / `Generator`.
- Builds on the type/error skeleton, the structural schema and `resolveConfigFile`.

## To do

1. `packages/config/src/load.ts`:
   - `export interface LoadResult { config: ResolvedConfig; configFile: string; rootDir: string }`.
   - `export async function loadConfig(opts?: { cwd?: string; configPath?: string }): Promise<LoadResult>`:
     1. `configFile = resolveConfigFile({ cwd: opts?.cwd ?? process.cwd(), configPath: opts?.configPath })`;
        `rootDir = path.dirname(configFile)`.
     2. `jiti = createJiti(rootDir, { interopDefault: true, moduleCache: false })`;
        `mod = await jiti.import(configFile, { default: true })`. Any throw →
        `ConfigLoadError` (wrap `cause`). `mod == null` → `NoDefaultExportError`.
     3. `v.safeParse(TakoConfigSchema, mod)`; on failure → `ConfigShapeError` with
        `normalizeIssues(...)`.
     4. Cross-field checks → typed errors:
        - duplicate `generators[].use.name` → `DuplicateGeneratorError`;
        - a `namespaces` entry not present in `sources` → `UnknownNamespaceError`;
        - `output.mode === 'package'` without `packagesDir` **or without `scope`** →
          `ConfigShapeError` (the mode-B `package.json` `name` is `${scope}/${namespace}` —
          [output-modes](../features/output-modes/technical.md)).
     5. Per entry: `parsed = use.optionsSchema ? v.parse(use.optionsSchema, options) : assertNoOptions(options)`.
        `v.parse` failure → `DriverOptionsError { role, name, namespace?, issues }`.
        `assertNoOptions` throws `DriverOptionsError` unless `options` is `undefined` or a
        plain object.
     6. Build `resolved.sources[ns] = { parser: { name, parse: ctx => use.parse(ctx, parsed), ...(use.watchPaths && { watchPaths: ctx => use.watchPaths(ctx, parsed) }) }, options: parsed }`.
        Build `resolved.generators[use.name] = { generator: { name, dependsOn, optionalDependsOn, generate: ctx => use.generate(ctx, parsed) }, options: parsed, namespaces: entry.namespaces }`.
     7. `resolved.output`: default `{ mode: 'dir', dir: './generated/kurotako' }`; resolve
        `dir` / `packagesDir` absolute against `rootDir`; pass `scope` / `packageManager`
        through unchanged.
     8. `resolved.rootDir = rootDir`; `resolved.hooks = mod.hooks`.
     9. return `{ config: resolved, configFile, rootDir }`.
2. Add `loadConfig` / `LoadResult` to the `index.ts` barrel.
3. `packages/config/src/load.test.ts` — fake driver module written to a temp file and
   loaded through `jiti` (or a stubbed importer):
   - valid config → `ResolvedConfig` with `generators` keyed by name, `output.dir`
     absolute, `rootDir` set, `hooks` passed through;
   - `optionsSchema` validates and the parsed value reaches the curried `parse` /
     `generate`;
   - bad `options` → `DriverOptionsError` naming driver + namespace;
   - duplicate generator name → `DuplicateGeneratorError`;
   - `namespaces: ['nope']` → `UnknownNamespaceError`;
   - `output.mode: 'package'` without `packagesDir` (or without `scope`) → `ConfigShapeError`;
   - `output.mode: 'package'` with both `packagesDir` and `scope` → resolves, `packageManager`
     passed through;
   - config file throwing on import → `ConfigLoadError` with `cause`;
   - no default export → `NoDefaultExportError`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [22-config-types-and-errors](22-config-types-and-errors.md)
- [23-config-schema](23-config-schema.md)
- [24-config-resolve](24-config-resolve.md)
