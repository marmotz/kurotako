# Configuration system — technical design

Design for the config surface. Product decisions come from [overview.md](overview.md);
the pipeline contract this feature must feed lives in
[core-pipeline/technical.md](../core-pipeline/technical.md) and the validation-library
choice in [ir-model/technical.md](../ir-model/technical.md). This document turns the
overview into a concrete package, type surface and load algorithm.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md)
  scaffolds the package skeletons; this feature added a **seventh, `@kurotako/config`**
  (`ir`, `core`, `config`, `cli`, `parser-prisma`, `gen-zod`, `gen-angular`) — #6 and its
  technical doc already updated, not yet implemented.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API** — the package must run unmodified on Node and Bun.
- Upstream contracts already designed:
  - [`@kurotako/core`](../core-pipeline/technical.md) declares `ResolvedConfig`,
    `SourceConfig`, `GeneratorConfig`, `OutputConfig`, `Hooks`, `Parser`, `Generator`,
    `ParseContext`, `GenerateContext`, the `TakoError` base and its subclasses
    ([core-pipeline/technical.md §Config consumed / §Driver contracts / §Error model](../core-pipeline/technical.md)).
  - [`@kurotako/ir`](../ir-model/technical.md) is **schema-first on Valibot** and exposes
    `SourceIR` / `IR` types and the Valibot schemas.
- Relevant design decisions (see [docs/vision.md](../../../docs/vision.md) and
  [docs/architecture.md](../../../docs/architecture.md)): `tako` binary, `@kurotako/*`
  scope; namespace = config key, a parser package instantiated several times; output
  modes A / B.

## Package

New package **`@kurotako/config`**.

```
packages/config/src/
  index.ts        # barrel: defineConfig, loadConfig, resolveConfigFile, types, errors, CONFIG_TEMPLATE
  types.ts        # TakoConfig, TakoParser<O>, TakoGenerator<O>, entry types, OptionsOf<D>
  define.ts       # defineConfig() — identity + typing
  schema.ts       # Valibot schema for the *structural* part of the config
  resolve.ts      # resolveConfigFile(): walk up for tako.config.ts
  load.ts         # loadConfig(): jiti import + validate + build ResolvedConfig
  errors.ts       # ConfigError hierarchy (extends TakoError from core)
  template.ts     # CONFIG_TEMPLATE string for `tako init`
  *.test.ts       # colocated vitest suites
```

Dependencies:

| Dep | Kind | Why |
|---|---|---|
| `@kurotako/core` | **`peerDependencies`** + `devDependencies` (`workspace:*`) | `ResolvedConfig` / `Parser` / `Generator` / context **types**, and the `TakoError` base **value** — config errors `extends TakoError` and the CLI catches everything with one `instanceof TakoError`, so `config` and the CLI **must** see the same `core` instance. Peer, not a plain dependency (see [Peer dependency policy](../monorepo-bootstrap/technical.md#peer-dependency-policy)); the leaf `@kurotako/cli` provides the concrete version. |
| `@kurotako/ir` | `dependencies` (`workspace:*`) | `SourceIR` **type** in the `TakoParser.parse` signature. Plain dependency: `ir` is a pure data + pure-function lib with no shared class identity, so a duplicate copy is harmless. |
| `valibot` | `dependencies` | config structural schema + running each driver's `optionsSchema` |
| `jiti` | `dependencies` | load a `.ts` config file at runtime (decided) |

`tsconfig.json` `references`: `[{ "path": "../core" }, { "path": "../ir" }]`.
`"sideEffects": false`.

**Dependency direction**: `cli -> config -> core -> ir` (`config -> core` is a peer edge).
No cycle: core never imports config (it receives an already-built `ResolvedConfig`).

### Why a dedicated package (alternatives considered)

- **Fold into `@kurotako/core`.** Rejected: core-pipeline locked "runtime dependency:
  `@kurotako/ir` only" ([core-pipeline/technical.md §Package shape](../core-pipeline/technical.md));
  adding `jiti` + `valibot` there breaks that and pulls a TS loader into the orchestration
  core.
> **Note (meta-package, #86):** the documented import in user projects is
> `import { defineConfig } from 'kurotako'` — the `kurotako` umbrella package re-exports
> `defineConfig` / `defineParser` / `defineGenerator` and the config type surface.
> `@kurotako/config` stays published as the direct-dependency escape hatch for consumers
> that need the loader internals (`loadConfig`, `TakoConfigSchema`, error classes,
> `CONFIG_TEMPLATE`).

- **Fold into `@kurotako/cli`.** Rejected: the user's `tako.config.ts` does
  `import { defineConfig } from '@kurotako/config'`; sourcing it from `@kurotako/cli`
  makes every config file depend on the whole executable (arg parser, reporters). A
  loader/validator is library code, not CLI code.
- **New `@kurotako/config`.** Retained: small, single responsibility (resolve + load +
  validate + types), unit-testable without spawning the binary, standard layering. Cost:
  one extra skeleton in monorepo-bootstrap #6 (not yet done).

## Config shape and `defineConfig` (`types.ts` + `define.ts`)

```ts
import type * as v from 'valibot'
import type { SourceIR } from '@kurotako/ir'
import type { ParseContext, GenerateContext, GenOutput } from '@kurotako/core'

export interface TakoParser<O = void> {
  name: string
  optionsSchema?: v.GenericSchema<unknown, O>
  parse(ctx: ParseContext, options: O): SourceIR | Promise<SourceIR>
  watchPaths?(ctx: ParseContext, options: O): string[] | Promise<string[]>  // curried like parse; consumed by cli --watch
}

export interface TakoGenerator<O = void> {
  name: string
  dependsOn?: string[]
  optionalDependsOn?: string[]
  optionsSchema?: v.GenericSchema<unknown, O>
  generate(ctx: GenerateContext, options: O): GenOutput | Promise<GenOutput>
}

// options type carried by an entry: whatever the driver's optionsSchema infers, else never
export type OptionsOf<D> =
  D extends { optionsSchema: v.GenericSchema<unknown, infer O> } ? O : undefined

export interface SourceEntry<D extends TakoParser<any> = TakoParser<any>> {
  use: D
  options?: OptionsOf<D>
}

export interface GeneratorEntry<D extends TakoGenerator<any> = TakoGenerator<any>> {
  use: D
  options?: OptionsOf<D>
  namespaces?: string[]           // restrict this generator's IR view; default = all
}

export interface OutputOption {
  dir?: string                    // mode A (default); relative paths resolved against the config file dir
  mode?: 'dir' | 'package'
  packagesDir?: string            // mode B (required for mode B)
  scope?: string                  // mode B (required for mode B — the package.json `name` needs it)
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'  // mode B, optional — output-modes auto-install
}

export interface TakoHooks {
  afterEmit?(ctx: import('@kurotako/core').AfterEmitContext): void | Promise<void>
}

export interface TakoConfig {
  sources: Record<string, SourceEntry>       // key === namespace
  generators: GeneratorEntry[]               // array; order irrelevant (core resolves the DAG)
  output?: OutputOption                      // default { dir: './generated/kurotako' }
  hooks?: TakoHooks
}

export function defineConfig<const C extends TakoConfig>(config: C): C {
  return config
}
```

- `defineConfig` is **identity at runtime**; its only job is to bind the generic so an
  editor infers each entry's `options` from `use.optionsSchema` (`OptionsOf<D>`) and
  flags an unknown key. A driver with no `optionsSchema` gets `options?: undefined` — a
  passed `options` is then a type error.
- `generators` is an **array of entries** (overview decision). `use.name` is the identity;
  `load.ts` keys the resolved map by it.
- The driver-facing contract is `TakoParser<O>` / `TakoGenerator<O>` — core's `Parser` /
  `Generator` **plus** `optionsSchema` and an `options` second argument.
  `load.ts` curries that argument away (see below) so `@kurotako/core` stays untouched.

### Not schema-first (deviation from `@kurotako/ir`, on purpose)

`@kurotako/ir` infers its types from Valibot schemas. The config **cannot**: `use` holds
a live function/object (`TakoParser` / `TakoGenerator`), and `hooks.afterEmit` is a
function — Valibot describes data, not instances. So here the **TS types are
hand-authored** and the Valibot schema in `schema.ts` validates only the **structural**
part (see next section). This split is the reason the config keeps both a `types.ts` and a
`schema.ts` where `ir` collapses them.

## Structural validation (`schema.ts`)

A Valibot schema over the **shape**, run after the module loads. It does **not** re-check
what TypeScript already guarantees at authoring time for typed configs — it exists for
configs written in plain JS, hand-edited, or produced programmatically, and to turn a
bad shape into a located message.

```ts
const DriverObject = v.pipe(
  v.object({ name: v.pipe(v.string(), v.minLength(1)) }),
  v.check(d => typeof (d as any).parse === 'function' || typeof (d as any).generate === 'function',
          'driver has neither parse() nor generate()'),
)

export const TakoConfigSchema = v.object({
  sources: v.pipe(
    v.record(v.pipe(v.string(), v.regex(NAMESPACE_RE)), v.object({
      use: DriverObject,
      options: v.optional(v.unknown()),
    })),
    v.minEntries(1),
  ),
  generators: v.array(v.object({
    use: DriverObject,
    options: v.optional(v.unknown()),
    namespaces: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
  })),
  output: v.optional(v.object({
    dir: v.optional(v.string()),
    mode: v.optional(v.picklist(['dir', 'package'])),
    packagesDir: v.optional(v.string()),
    scope: v.optional(v.string()),
    packageManager: v.optional(v.picklist(['bun', 'pnpm', 'yarn', 'npm'])),
  })),
  hooks: v.optional(v.object({
    afterEmit: v.optional(v.pipe(v.unknown(), v.check(f => f === undefined || typeof f === 'function'))),
  })),
})
```

- `NAMESPACE_RE` — `^[a-z][a-zA-Z0-9]*$` (a namespace becomes a directory / submodule
  name and an import-path segment, [docs/architecture.md](../../../docs/architecture.md));
  pin it here, referenced by [output-modes](../output-modes/overview.md).
- Cross-field checks done **after** `v.parse` (not expressible structurally), in `load.ts`:
  - duplicate `generators[].use.name` -> `DuplicateGeneratorError`;
  - every string in a `namespaces` allowlist exists in `sources` -> `UnknownNamespaceError`;
  - `output.mode === 'package'` requires **both** `packagesDir` and `scope` (the mode-B
    `package.json` `name` is `${scope}/${namespace}`) -> `ConfigShapeError`; `output.mode`
    absent/`'dir'` uses `output.dir`. `packageManager` stays optional
    ([output-modes/technical.md §Package manager](../output-modes/technical.md#package-manager-mode-b)).
- Driver **`options`** are **not** validated here (kept `v.unknown()`); they are validated
  per entry against `use.optionsSchema` — see "Building `ResolvedConfig`".

## File resolution (`resolve.ts`)

```ts
export function resolveConfigFile(opts: { cwd: string; configPath?: string }): string
```

- `configPath` given (from the CLI `--config` flag): resolve against `cwd`; must exist and
  end in `.ts` / `.mts` / `.cts` (overview: `.ts` only). Missing -> `ConfigNotFoundError`.
- Otherwise: look for **`tako.config.ts`** starting in `cwd`, then each parent directory,
  stopping at the first hit. Stop the walk at a directory containing `.git` (inclusive) or
  at the filesystem root. Not found -> `ConfigNotFoundError` listing the directories tried.
- Only the exact name `tako.config.ts` in the auto-walk (overview decision — no
  `.mts`/`.js` variants, no `tako.config.*` glob). `--config` is the escape hatch.

## Loading and building `ResolvedConfig` (`load.ts`)

```ts
export interface LoadResult {
  config: ResolvedConfig          // the @kurotako/core shape
  configFile: string              // absolute path actually loaded
  rootDir: string                 // dirname(configFile); anchor for relative paths + parser cwd
}

export async function loadConfig(opts?: { cwd?: string; configPath?: string }): Promise<LoadResult>
```

Algorithm:

1. `configFile = resolveConfigFile({ cwd: opts?.cwd ?? process.cwd(), configPath: opts?.configPath })`.
   `rootDir = path.dirname(configFile)`.
2. **Import** via `jiti`:
   ```ts
   const jiti = createJiti(rootDir, { interopDefault: true, moduleCache: false })
   const mod = await jiti.import<unknown>(configFile, { default: true })
   ```
   A throw (syntax error, unresolved import, driver package not installed) is caught and
   rewrapped as `ConfigLoadError` (carries `cause`). `mod === undefined` / no default
   export -> `NoDefaultExportError`.
3. **Structural validate**: `v.safeParse(TakoConfigSchema, mod)`. On failure, normalise
   issues to `{ path, message }` (dotted, e.g. `generators.0.use`) and throw
   `ConfigShapeError`.
4. **Cross-field checks** (list above) -> `DuplicateGeneratorError` /
   `UnknownNamespaceError` / `ConfigShapeError`.
5. **Per-driver options + currying**. For each source entry `[ns, { use, options }]`:
   - `parsed = use.optionsSchema ? v.parse(use.optionsSchema, options) : assertNoOptions(options)`.
     A `v.parse` failure -> `DriverOptionsError { role: 'parser', name: use.name, namespace: ns, issues }`.
     `assertNoOptions` throws `DriverOptionsError` if `options` is neither `undefined` nor
     a plain object (overview: "core only checks the `options` field is an object or missing").
   - Produce the **core `Parser`** (currying `watchPaths` too when the driver defines it):
     ```ts
     resolved.sources[ns] = {
       parser: {
         name: use.name,
         parse: (ctx) => use.parse(ctx, parsed as never),
         ...(use.watchPaths && { watchPaths: (ctx) => use.watchPaths!(ctx, parsed as never) }),
       },
       options: parsed,
     }
     ```
   Generators likewise, keyed by `use.name`, carrying `namespaces` and
   `dependsOn` / `optionalDependsOn` copied from `use`:
   ```ts
   resolved.generators[use.name] = {
     generator: { name: use.name, dependsOn: use.dependsOn, optionalDependsOn: use.optionalDependsOn,
                  generate: (ctx) => use.generate(ctx, parsed as never) },
     options: parsed,
     namespaces: entry.namespaces,
   }
   ```
6. **Resolve `output`**: default `{ mode: 'dir', dir: './generated/kurotako' }`. Resolve
   `dir` / `packagesDir` to absolute against `rootDir`.
7. **hooks**: pass `mod.hooks` through unchanged to `resolved.hooks`.
8. Return `{ config: resolved, configFile, rootDir }`.

`loadConfig` never touches the pipeline; the CLI calls it, then
`run(result.config, { logger, /* cwd */ })`.

### `rootDir` / parser `cwd`

Parsers must resolve schema paths against the **config file's directory**. Previously
[core-pipeline/technical.md §Orchestration step 1](../core-pipeline/technical.md) built
`ParseContext` with a `cwd` that had no source on `ResolvedConfig` or `RunOptions`. This
is now fixed there: `ResolvedConfig.rootDir: string` (absolute), set by `loadConfig` to
`dirname(configFile)`, consumed in step 1 as `ParseContext.cwd`. Task
[#15](../../tasks/15-core-types-and-contracts.md) / [#21](../../tasks/21-core-run.md)
carry it.

## `tako init` template (`template.ts`)

`export const CONFIG_TEMPLATE: string` — a commented `tako.config.ts`:

```ts
import { defineConfig } from '@kurotako/config'
// import { prismaParser } from '@kurotako/parser-prisma'
// import { zodGenerator } from '@kurotako/gen-zod'

export default defineConfig({
  sources: {
    // pg: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
  },
  generators: [
    // { use: zodGenerator },
  ],
  output: { dir: './generated/kurotako' },
})
```

The `tako init` **command** (write the file, refuse if it exists, no detection, no
prompts — overview) lives in [cli](../cli/overview.md); it imports `CONFIG_TEMPLATE`.
Keeping the string here means the config package owns what a valid file looks like.

## Errors (`errors.ts`)

All extend `TakoError` from `@kurotako/core` (so the CLI's `catch (e) if (e instanceof
TakoError)` covers config errors too). Codes are namespaced `config_*` /
`driver_options_*`.

| Class | `code` | Thrown when |
|---|---|---|
| `ConfigNotFoundError` | `config_not_found` | no `tako.config.ts` up the tree, or `--config` path missing |
| `ConfigLoadError` | `config_load_error` | `jiti` throws importing the file (wraps `cause`) |
| `NoDefaultExportError` | `config_no_default_export` | module has no usable default export |
| `ConfigShapeError` | `config_invalid` | `TakoConfigSchema` / cross-field check fails (carries located issues) |
| `DuplicateGeneratorError` | `config_duplicate_generator` | two `generators[]` entries share `use.name` |
| `UnknownNamespaceError` | `config_unknown_namespace` | a `namespaces` allowlist names a namespace absent from `sources` |
| `DriverOptionsError` | `driver_options_invalid` | an entry's `options` fails `use.optionsSchema` (carries role + name + namespace? + issues) |

Reuse core's `IrValidationError` shape convention (`issues: { path; message }[]`) for the
carrying ones.

## Consequences verified against the current repo / other features

- **monorepo-bootstrap [#6](../../tasks/6-package-skeletons.md)** — a seventh skeleton
  `packages/config` (`@kurotako/config`), `tsconfig` referencing `../core` + `../ir`, and
  `cli` referencing `../config`. Applied: task #6, its issue,
  [monorepo-bootstrap/technical.md §Target layout](../monorepo-bootstrap/technical.md) and
  its overview updated (#6 not yet implemented).
- **monorepo-bootstrap [§Peer dependency policy](../monorepo-bootstrap/technical.md#peer-dependency-policy)**
  — added by this feature: `@kurotako/config` takes `@kurotako/core` as a
  `peerDependency` + `devDependency` (not a plain `dependency`) so `config` and the CLI
  share one `TakoError` class instance. Task [#22](../../tasks/22-config-types-and-errors.md).
- **core-pipeline [#15](../../tasks/15-core-types-and-contracts.md)** — `ResolvedConfig`
  gains `rootDir: string`; step 1 of `run.ts` sets `ParseContext.cwd = config.rootDir`.
  Applied: [core-pipeline/technical.md](../core-pipeline/technical.md) (§Config consumed,
  §Orchestration step 1, §Driver options, §Consequences), tasks #15 / #21 and their
  issues.
- **core stays otherwise untouched**: `Parser` / `Generator` keep their single-argument
  `parse(ctx)` / `generate(ctx)`; `@kurotako/config` curries the `options` argument in.
  The "driver options — seam left to config-system" note in
  [core-pipeline/technical.md](../core-pipeline/technical.md) is now resolved: **injected
  model, curried by config-system**.
- **parser-prisma / generator-zod / generator-angular** — their public export is now
  fixed: a `TakoParser<O>` / `TakoGenerator<O>` **object** (not a factory) with a
  `name`, an optional `optionsSchema` (Valibot), and `parse(ctx, options)` /
  `generate(ctx, options)`. Their overviews list "shape of the driver contract" as an
  open question; this answers the config-facing half. `valibot` becomes a dependency of
  each driver that declares options.
- **cli** — depends on `@kurotako/config`; `tako generate` = `loadConfig()` then
  `run()`; `tako init` writes `CONFIG_TEMPLATE`; `tako validate` = `loadConfig()` +
  `run({ write: false })`. `--config <path>` is forwarded to `loadConfig`. Additive:
  `TakoParser` gained an optional `watchPaths?(ctx, options)` that `load.ts` curries like
  `parse`, consumed by `tako generate --watch`
  ([cli/technical.md](../cli/technical.md#the-watchpaths-contract-addition)).
- **ir-model** — unaffected; `@kurotako/config` only imports the `SourceIR` type.
- **[output-modes/technical.md](../output-modes/technical.md)** — added
  `output.packageManager?` (picklist, optional) to `OutputOption` + `TakoConfigSchema`,
  and tightened the mode-B cross-field check to require `scope` as well as `packagesDir`.
  Tasks [#22](../../tasks/22-config-types-and-errors.md) /
  [#23](../../tasks/23-config-schema.md).
- **docs/architecture.md** — the `output:` YAML snippets illustrate the shape but the
  format is `.ts`; reconcile the examples to `defineConfig({ output: { ... } })` when this
  lands (doc-only, not this phase).

## Tests (vitest, colocated)

- `resolve`: finds `tako.config.ts` in cwd; finds it two directories up; stops at `.git`;
  `ConfigNotFoundError` when absent; `--config` path honoured and its missing-file error.
- `schema`: a minimal valid config passes; empty `sources` fails; bad namespace key fails
  with a located path; `output.mode: 'package'` without `packagesDir` fails; `afterEmit`
  not-a-function fails.
- `load` with a fake driver module (in-memory, via `jiti` on a temp file or a stubbed
  importer):
  - valid config -> `ResolvedConfig` with `generators` keyed by name, `output.dir`
    absolute, `rootDir` set;
  - `optionsSchema` validates and the parsed value reaches the curried `parse`;
  - a bad `options` -> `DriverOptionsError` naming the driver + namespace;
  - duplicate generator name -> `DuplicateGeneratorError`;
  - `namespaces: ['nope']` -> `UnknownNamespaceError`;
  - a config file that throws on import -> `ConfigLoadError` with `cause`;
  - no default export -> `NoDefaultExportError`.
- `define`: `defineConfig` returns its input unchanged (identity); type-level test
  (`*.test-d.ts`) that `options` is inferred from `use.optionsSchema` and rejected when
  the driver has none.
- `template`: `CONFIG_TEMPLATE` parses as valid TS and, with the imports uncommented
  against fake drivers, satisfies `TakoConfigSchema`.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#22 config-types-and-errors](../../tasks/22-config-types-and-errors.md) — `types.ts`
   (`TakoConfig`, `TakoParser<O>` / `TakoGenerator<O>`, entry types, `OptionsOf<D>`),
   `define.ts` (`defineConfig`), `errors.ts` (`ConfigError` hierarchy on `TakoError`),
   `template.ts` (`CONFIG_TEMPLATE`), barrel + `package.json` deps + `tsconfig` refs
   (deps: #6, #11, #15).
2. [#23 config-schema](../../tasks/23-config-schema.md) — `schema.ts`: `NAMESPACE_RE`,
   `TakoConfigSchema` (structural Valibot), `normalizeIssues` (dep: #22).
3. [#24 config-resolve](../../tasks/24-config-resolve.md) — `resolve.ts`:
   `resolveConfigFile()` walk-up + `--config` override (dep: #22).
4. [#25 config-load](../../tasks/25-config-load.md) — `load.ts`: `loadConfig()` — `jiti`
   import, structural validate, cross-field checks, per-driver options + currying, output
   resolution, `LoadResult` (deps: #22, #23, #24).
