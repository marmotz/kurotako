# Orchestration (`@kurotako/core`) — technical design

Design for `@kurotako/core`. Product decisions come from [overview.md](overview.md); the
pipeline model and the driver-role vocabulary live in
[docs/architecture.md](../../../docs/architecture.md) and
[docs/glossary.md](../../../docs/glossary.md). This document turns the
overview decisions into a concrete API surface and orchestration algorithm.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) scaffolds
  `packages/core/` with a single `src/index.ts` exporting a `version` const and one
  trivial test ([task 6](../../tasks/6-package-skeletons.md)). This feature replaces that
  placeholder with the real module.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API** — disk access uses `node:fs/promises`.
- Upstream contract: [`@kurotako/ir`](../ir-model/technical.md) is designed and provides
  the `SourceIR` / `IR` types, `validateSourceIR` / `assertIR`, `isCompatible`, and the
  traversal helpers. **Merge is explicitly left to this package**
  ([ir-model/technical.md §Out of scope here](../ir-model/technical.md)).
- Downstream, none implemented: [config-system](../config-system/overview.md) produces the
  `ResolvedConfig` this package consumes; [parser-prisma](../parser-prisma/overview.md)
  implements `Parser`; [generator-zod](../generator-zod/overview.md) /
  [generator-angular](../generator-angular/overview.md) implement `Generator`;
  [cli](../cli/overview.md) calls `run()`; [output-modes](../output-modes/overview.md)
  adds the mode B writer; [cli](../cli/overview.md) `--watch` wraps `run()`.
- Relevant design decisions (see [docs/architecture.md](../../../docs/architecture.md)):
  DAG, hard vs optional deps; namespace = config key, one package instantiated several
  times; key `(namespace, entity)`; output modes A / B.

## Package shape

Single entry point (keeps the `exports` map identical to the bootstrap skeleton).

```
packages/core/src/
  index.ts        # barrel: run() + every public type
  types.ts        # ResolvedConfig, Parser, Generator, contexts, GenOutput, artifacts, hooks, Logger
  run.ts          # the orchestrator
  merge.ts        # mergeSources(): SourceIR[] -> IR  (+ duplicate-namespace rejection)
  graph.ts        # generatorOrder(): topological order, missing-dep / cycle detection
  filter.ts       # filterIR(ir, namespaces): IR  (deep clone of a namespace subset)
  collect.ts      # mergeTrees(): aggregate virtual files + path-collision detection
  writer/         # Writer seam — see output-modes/technical.md for the full module set
    index.ts      #   selectWriter(output)
    directory.ts  #   directoryWriter (mode A)
    package.ts    #   packageWriter (mode B) — added by output-modes
    barrel.ts     #   synthesizeRootBarrels() — mode-independent, added by output-modes
    banner.ts     #   applyBanner() + GITATTRIBUTES — added by output-modes
  errors.ts       # TakoError hierarchy
  *.test.ts       # colocated vitest suites
```

- **Runtime dependency: `@kurotako/ir` at all times** (`workspace:*`); **`tsup` lazily,
  mode B only** (`import('tsup')` inside `packageWriter`, dynamic so a mode-A run never
  loads it) and `node:child_process` for the mode-B package-manager install — both added
  by [output-modes](../output-modes/technical.md), which decided the mode-B plumbing lives
  here rather than in a dedicated `@kurotako/output` package. `graph` / `merge` /
  `directoryWriter` stay hand-written; no graph library, no `fs-extra`.
- `packages/core/tsconfig.json` gets `references: [{ "path": "../ir" }]` (already the rule
  in [task 6](../../tasks/6-package-skeletons.md) step 2).
- `"sideEffects": false`.

## Public API (`run.ts` + `types.ts`)

```ts
export async function run(config: ResolvedConfig, opts?: RunOptions): Promise<RunResult>

export interface RunOptions {
  logger?: Logger          // default: no-op
  signal?: AbortSignal     // cooperative cancellation between steps (watch mode)
  write?: boolean          // default true; false => run everything, skip the Writer
}

export interface RunResult {
  ir: IR                                  // merged, validated (for --emit-ir, drift-guard)
  order: string[]                         // generator short names, in execution order
  files: VirtualFile[]                    // aggregated virtual tree, sorted by path
  artifacts: Record<string, GeneratorArtifact>   // generator short name -> its artifact
}
```

`run()` is the only entry point. It is pure with respect to its inputs except for the
single `Writer` call at the end (skippable via `write: false`, which is what `--dry-run`
and `drift-guard` use).

### Config consumed (`ResolvedConfig`)

Produced and validated by [config-system](../config-system/overview.md); core only
declares the shape it needs.

```ts
export interface ResolvedConfig {
  rootDir: string                             // absolute; dir of the config file. Anchor for
                                              // relative output paths and for ParseContext.cwd
  sources: Record<string, SourceConfig>       // key === namespace
  generators: Record<string, GeneratorConfig> // key === Generator.name (short name)
  output: OutputConfig
  hooks?: Hooks
}

export interface SourceConfig {
  parser: Parser
  options?: unknown       // seam: see "Driver options" below
}

export interface GeneratorConfig {
  generator: Generator
  options?: unknown
  namespaces?: string[]   // restrict this generator to a subset; default = all
}

export interface OutputConfig {
  mode?: 'dir' | 'package'   // default 'dir'
  dir?: string               // mode A, resolved absolute by config-system
  packagesDir?: string       // mode B
  scope?: string             // mode B (required for mode B — config-system enforces)
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'  // mode B, optional — output-modes
}
```

### Driver contracts

```ts
export interface Parser {
  name: string                                   // "prisma"
  parse(ctx: ParseContext): Promise<SourceIR> | SourceIR
  watchPaths?(ctx: ParseContext): string[] | Promise<string[]>  // metadata for watchers; run() never calls it
}

export interface ParseContext {
  namespace: string
  cwd: string
  logger: Logger
}

export interface Generator {
  name: string                                   // "angular"
  dependsOn?: string[]                            // hard: absent from config => error
  optionalDependsOn?: string[]                    // optional: used if present, else ignored
  generate(ctx: GenerateContext): Promise<GenOutput> | GenOutput
}

export interface GenerateContext {
  ir: IR                                          // namespace-filtered view (see below)
  dependencies: Record<string, GeneratorArtifact> // only declared deps that are present
  logger: Logger
}

export interface GenOutput {
  files: VirtualFile[]
  artifact: GeneratorArtifact
}

export interface VirtualFile {
  path: string       // POSIX, relative to the output root; the generator owns the
                     // `<namespace>/<generatorName>/` prefix (per output-modes: one sub-tree
                     // per generator; core synthesizes `<namespace>/index.ts`)
  content: string
}
```

- **Hard vs optional dependency** is expressed as **two separate arrays**, not a tagged
  union. A name may not appear in both. Rationale: an exhaustive, greppable contract; no
  per-entry object to validate; `gen-angular` reads `optionalDependsOn: ['zod']` and the
  intent is unambiguous.
- **`GenerateContext` is minimal** (decided): `{ ir, dependencies, logger }`. No `cwd`,
  no `outputMode`, no pre-bound helpers — the generator imports the traversal helpers
  from `@kurotako/ir` itself. No filesystem handle: a generator returns a virtual tree
  and never writes.
- **`ParseContext`** carries `cwd` (parsers resolve schema paths against it) and the
  contextual `logger`.

### Driver options — seam left to config-system

How a driver receives its options was a **config-format decision**, deferred to
[config-system](../config-system/technical.md) — now **settled there**: the driver is a
`TakoParser<O>` / `TakoGenerator<O>` object with an optional Valibot `optionsSchema` and
a `parse(ctx, options)` / `generate(ctx, options)` signature; `@kurotako/config`
validates `options` against `optionsSchema` and **curries the argument away**, handing
core a plain `Parser` / `Generator` with the single-argument `parse(ctx)` / `generate(ctx)`
shape below. Core stays neutral and unchanged:

- Core needs only a `Parser` / `Generator` **object** plus an opaque `options?: unknown`
  on `SourceConfig` / `GeneratorConfig` (kept for `--emit` / debugging; core does not read
  it).
- The base contexts do not mention `options` — the curried closure carries them.

### Artifact manifest (`GeneratorArtifact`)

Fixed interop shape imposed by core, plus a free `extra` slot each generator types on its
own side (decided).

```ts
export interface GeneratorArtifact {
  entities: Record<string, EntitySymbols>   // key === `${namespace}.${entity}`
  peerDependencies?: Record<string, string> // package -> semver range the emitted code imports
                                            // (mode B: core aggregates per namespace) — output-modes
  extra?: unknown                            // generator-defined; consumer casts
}

export interface EntitySymbols {
  module: string                    // module specifier a sibling generator imports from
  symbols: Record<string, string>   // role -> exported identifier, e.g. { schema: "UserSchema", type: "User" }
}
```

- A dependent looks up `ctx.dependencies.zod.entities['pg.User'].symbols.schema`. Roles
  are free strings; the producing and consuming generators agree on the vocabulary
  (settled in [generator-zod](../generator-zod/overview.md) /
  [generator-angular](../generator-angular/overview.md)).
- `extra` covers richer needs (Zod exposing `create` / `update` / `where` schema names)
  without threading a generic `Manifest` type parameter through `Generator`, the core, and
  `RunResult`. The cost is that `extra` is `unknown` at the core boundary and the consumer
  casts to the producer's published type.
- Dependents consume this structure, **never raw file paths** — this is what decouples
  `gen-angular` from `gen-zod`'s output tree. Answers
  [docs/vision.md open question §3](../../../docs/vision.md#open-questions).

### Hooks (`Hooks`)

Minimal in v1 (decided). Exact set fixed here: **one hook**, `afterEmit`.

```ts
export interface Hooks {
  afterEmit?(ctx: AfterEmitContext): Promise<void> | void
}

export interface AfterEmitContext {
  outputDir: string       // absolute; the directory the Writer just populated
  files: string[]         // absolute paths actually written, sorted
  logger: Logger
}
```

- Covers the driving use case (run a formatter — Biome / Prettier — over the freshly
  written tree). It fires only in `write: true` runs, after the `Writer`.
- `beforeParse` / `afterParse` / `beforeGenerate` / a virtual-tree `beforeEmit` transform
  are deliberately **not** in v1: no concrete need yet, and each widens a contract that
  `cli` watch mode and `drift-guard` will also have to honor. They are additive later.

### Logger

```ts
export interface Logger {
  debug(msg: string, meta?: unknown): void
  info(msg: string, meta?: unknown): void
  warn(msg: string, meta?: unknown): void
  error(msg: string, meta?: unknown): void
}
```

Core ships a no-op default. [cli](../cli/overview.md) injects a real one. Contexts get a
child logger tagged with the namespace / generator name (implementation: a thin wrapper
that prefixes `meta`).

## Orchestration algorithm (`run.ts`)

Sequential, fail-fast. Each numbered step fully completes before the next; `opts.signal`
is checked at each boundary.

1. **Parse.** For each `[namespace, sourceConfig]` in `config.sources`, iterated in sorted
   namespace order for determinism:
   - `sourceIR = await parser.parse({ namespace, cwd: config.rootDir, logger })`.
   - Reject if `sourceIR.namespace !== namespace` (`NamespaceMismatchError`).
   - `validateSourceIR(sourceIR)` (from `@kurotako/ir`); on failure wrap the issues in
     `IrValidationError` tagged with the namespace.
   - A throw from `parse` is caught and rewrapped as `DriverError` with
     `{ role: 'parser', name, namespace }`.
2. **Merge** (`merge.ts`). `mergeSources(sourceIRs): IR`:
   - Build `{ irVersion: IR_VERSION, sources: {} }`, insert each `SourceIR` under its
     `namespace`.
   - Duplicate namespace key → `DuplicateNamespaceError` (cannot happen from a valid
     config since keys are unique, but a parser returning the wrong namespace or a future
     programmatic caller can trigger it — cheap to check).
   - `assertIR(ir)` — full cross-source validation + `isCompatible(ir.irVersion)`. Wrapped
     as `IrValidationError` on failure.
3. **Order** (`graph.ts`). `generatorOrder(config.generators): string[]`:
   - Nodes = generator short names present in the config. Edges = `dependsOn` +
     `optionalDependsOn` (both constrain order; only `dependsOn` constrains presence).
   - A `dependsOn` name absent from `config.generators` → `UnknownDependencyError`
     `{ generator, missing }`.
   - An `optionalDependsOn` name absent → dropped from the edge set, no error.
   - **Kahn's algorithm**, ties broken by config declaration order, for a deterministic
     sequence. A remaining non-empty set → `DependencyCycleError` with the cycle path.
4. **Generate.** For each generator name in `order`:
   - `view = filterIR(ir, generatorConfig.namespaces)` (`filter.ts`): a **deep clone**
     (`structuredClone`) of `ir` keeping only the requested namespaces in `ir.sources`
     (all of them when `namespaces` is undefined). Relations whose `target.namespace` is
     excluded stay in the clone as-is — `@kurotako/ir` validation already treats an
     absent target namespace as informational and v1 drivers ignore cross-source
     ([ir-model/technical.md](../ir-model/technical.md)). Deep clone (not a proxy) so a
     misbehaving generator cannot mutate the shared IR.
   - `deps = {}`; for each `d` in `dependsOn ∪ optionalDependsOn` that has already run,
     `deps[d] = artifacts[d]`. Hard deps are guaranteed present by step 3's ordering +
     presence check; optional deps may be absent.
   - `out = await generator.generate({ ir: view, dependencies: deps, logger })`. A throw
     → `DriverError` `{ role: 'generator', name }`.
   - Store `artifacts[name] = out.artifact`; keep `out.files` for step 5.
5. **Collect** (`collect.ts`). `mergeTrees(perGenerator): VirtualFile[]`:
   - Normalize every `path` (POSIX, no `..`, no leading `/`); reject an escaping path
     (`InvalidOutputPathError`).
   - Two generators emitting the same `path` → `OutputCollisionError`
     `{ path, generators: [a, b] }`. A generator emitting `<ns>/index.ts` directly (not
     under its `<ns>/<name>/` sub-tree) collides here with the synthesized barrel (step 5b).
   - Return the union sorted by `path` (deterministic — required by `drift-guard`).
5b. **Synthesize root barrels** (`writer/barrel.ts`, mode-independent, added by
   [output-modes](../output-modes/technical.md)). For each namespace present in the tree,
   emit `<ns>/index.ts` = one sorted `export * from './<generatorName>'` per generator that
   contributed a file under `<ns>/<generatorName>/`. Re-sort the union by `path`.
5c. **Apply banner** (`writer/banner.ts`). `applyBanner(files)` prepends
   `// Generated by tako. Do not edit.` to every `.ts`/`.tsx` file (synthesized barrels
   included). One call site for the whole tree; generators never add the banner.
6. **Write** (only if `opts.write !== false`). `selectWriter(config.output)` returns the
   mode A `directoryWriter` (`mode` absent/`'dir'`) or the mode B `packageWriter`
   (`mode: 'package'`, supplied by [output-modes](../output-modes/technical.md)); call
   `writer.write({ files, output })`. The mode A `directoryWriter`:
   - Resolves `output.dir`.
   - **Wipes it unconditionally** (`fs.rm(dir, { recursive: true, force: true })`) then
     recreates it — decided, no guard (see "Accepted risks").
   - Writes every file (`mkdir -p` parent, `writeFile` utf-8), in sorted order.
   - Writes `<dir>/.gitattributes` (`* linguist-generated=true`).
   - Returns the list of absolute paths written.

   The mode B `packageWriter` (one package per namespace, `package.json` + `peerDependencies`
   aggregation + tsup build + package-manager install) is fully specified in
   [output-modes/technical.md](../output-modes/technical.md).
7. **`afterEmit` hook** (only if it ran the writer). `await config.hooks?.afterEmit({
   outputDir, files, logger })` — `outputDir` is `output.dir` in mode A, `output.packagesDir`
   in mode B; `files` are the written **source** paths (not mode-B `dist/`). A throw
   propagates as `HookError`.
8. Return `RunResult { ir, order, files, artifacts }`.

### Writer seam

```ts
export interface Writer {
  write(input: { files: VirtualFile[]; output: OutputConfig }): Promise<string[]>
}
export const directoryWriter: Writer            // mode A, shipped here
export const packageWriter: Writer              // mode B, added by output-modes (same package)
export function selectWriter(output: OutputConfig): Writer
```

`selectWriter` returns `directoryWriter` when `output.mode` is `'dir'` or absent,
`packageWriter` when it is `'package'`, and throws `UnsupportedOutputModeError` otherwise.
Task [#20](../../tasks/20-core-writer.md) ships `directoryWriter` + a `selectWriter` that
still throws for `'package'`; [output-modes](../output-modes/technical.md) replaces that
branch with the real `packageWriter` **in this same package** (the "dedicated
`@kurotako/output` package" and the `RunOptions.writer?` override were both rejected —
see [output-modes/technical.md](../output-modes/technical.md#package-shape-all-in-kurotakocore)).

## Error model (`errors.ts`)

All fail-fast, all carrying enough context to name the culprit (decided: "message
identifying the offending source or generator").

```ts
export class TakoError extends Error { readonly code: string }
```

| Class | `code` | Thrown when |
|---|---|---|
| `NamespaceMismatchError` | `namespace_mismatch` | `parse()` returns a `SourceIR` whose `namespace` ≠ its config key |
| `IrValidationError` | `ir_invalid` | `validateSourceIR` / `assertIR` reports issues (carries `IrIssue[]` + namespace) |
| `DuplicateNamespaceError` | `duplicate_namespace` | two `SourceIR`s claim the same namespace |
| `UnknownDependencyError` | `unknown_dependency` | a `dependsOn` name is not in the config |
| `DependencyCycleError` | `dependency_cycle` | the generator graph has a cycle (carries the path) |
| `OutputCollisionError` | `output_collision` | two generators emit the same output path |
| `InvalidOutputPathError` | `invalid_output_path` | a generator emits a path escaping the output root |
| `UnsupportedOutputModeError` | `unsupported_output_mode` | `output.mode` is neither `'dir'` nor `'package'` |
| `OutputPeerConflictError` | `output_peer_conflict` | two generators declare the same peer dep with different ranges for one namespace (mode B) — output-modes |
| `PackageBuildError` | `package_build_error` | the tsup build of a generated package fails (mode B) — output-modes |
| `PackageInstallError` | `package_install_error` | the mode-B package-manager `install` exits non-zero — output-modes |
| `DriverError` | `driver_error` | a parser/generator `parse`/`generate` throws (wraps `cause`, tags role + name) |
| `HookError` | `hook_error` | a hook throws |

The CLI maps any `TakoError` to a formatted message + non-zero exit; an unexpected
non-`TakoError` throw is a bug and surfaces as a stack trace.

## Determinism

Required by [drift-guard](../drift-guard/overview.md) (regenerate in memory, diff against
disk) and desirable for reviewable output:

- sources parsed in sorted-namespace order;
- generator order is a stable topological sort (config order breaks ties);
- `filterIR` preserves key order from the merged IR;
- the aggregated tree is sorted by path before writing;
- no timestamps or absolute paths in generated content (a generator concern, noted for
  [output-modes](../output-modes/overview.md)'s "generated, do not edit" banner).

## What stays out of this feature

- **`ResolvedConfig` construction, config file format, driver-option validation, the
  `namespaces` / `hooks` config syntax** — [config-system](../config-system/overview.md).
  Core consumes an already-resolved, already-validated object.
- **Mode B `packageWriter` internals** (`package.json` emission, `peerDependencies`
  aggregation, tsup build, package-manager install), **the content of the synthesized
  barrel / banner steps**, **tsconfig `paths` guidance** —
  [output-modes](../output-modes/technical.md). That feature adds `writer/package.ts`,
  `writer/barrel.ts`, `writer/banner.ts`, `writer/peers.ts`, `writer/pm.ts` to this
  package and wires steps 5b / 5c / the `packageWriter` branch into `run.ts`; the seam
  (the `Writer` interface, `selectWriter`, steps 5–7) is defined here.
- **`--emit-ir` / `--dry-run` / `--watch` flags, log rendering, exit codes** —
  [cli](../cli/overview.md). Core exposes `RunResult.ir`, `RunOptions.write` and
  `RunOptions.signal` as the primitives these build on. The optional `Parser.watchPaths?()`
  member is metadata the CLI queries to build its watch set —
  [cli/technical.md](../cli/technical.md); `run()` ignores it.
- **Incremental / cached regeneration, file watching** — [cli](../cli/overview.md).
  v1 `run()` always does a full parse + full generate + full wipe.
- **The `SourceIR` / `IR` types, `validateSourceIR` / `assertIR`, `isCompatible`,
  traversal helpers, the builder** — [`@kurotako/ir`](../ir-model/technical.md).

## Alternatives considered

- **Put `mergeIR` in `@kurotako/ir`.** Rejected, consistent with
  [ir-model/technical.md](../ir-model/technical.md): `ir` has no notion of config or of
  several parsers running; merge + duplicate-namespace policy is orchestration.
- **Generators write to disk directly.** Rejected in the discussion: a virtual tree gives
  one I/O site, cross-generator collision detection, `--dry-run`, and a clean diff for
  `drift-guard` for free.
- **`Generator<Opts, Manifest>` generic manifest type.** Rejected (discussion): threads a
  type parameter through `Generator`, `dependencies`, `RunResult`. The fixed
  `{ entities, extra }` shape plus a cast on `extra` covers the interop need at a fraction
  of the type complexity.
- **`dependsOn: (string | { name: string; optional?: boolean })[]`.** Rejected in favour
  of two flat arrays: nothing to validate per entry, trivially greppable, and the
  hard/optional distinction is visible at a glance in a generator's source.
- **Namespace-filtered IR as a lazy proxy / view.** Rejected: `structuredClone` of a
  JSON-stable structure is cheap at v1 scale and removes any chance of a generator
  mutating shared state.
- **Rich `GenerateContext`** (cwd, output mode, pre-bound helpers). Rejected in the
  discussion: keeps the contract that `cli` watch mode / `drift-guard` must also satisfy as
  small as possible; a generator that needs a helper imports it from `@kurotako/ir`.
- **A wipe guard** (run marker, path check). Rejected: the overview decision is an
  unconditional wipe. Documented as an accepted risk below.
- **DFS topological sort.** Kahn chosen: natural place to break ties by config order and
  to detect a cycle (non-empty residual set) with a readable path.

## Accepted risks

- **Unconditional output wipe.** `directoryWriter` does `fs.rm(output.dir, { recursive:
  true, force: true })` with no check that the directory looks generated and no check that
  it is inside the project. A user pointing `output.dir` at a source directory loses it on
  the next `tako generate`. Mitigations live outside core: config-system can warn on a
  suspicious `output.dir`, the CLI documents it and offers `--dry-run`, and the generated
  tree carries a "do not edit" banner. Revisit if this bites in practice.

## Consequences verified against the current repo

- Nothing to migrate: `packages/core/src/index.ts` is the bootstrap placeholder
  ([task 6](../../tasks/6-package-skeletons.md)). This feature rewrites it into the module
  set above. `package.json` / `tsconfig.json` / `tsup.config.ts` / `vitest.config.ts` from
  bootstrap #6 are unchanged except for adding the `../ir` project reference (already
  mandated by task 6 step 2 for imported internal packages) and the `@kurotako/ir`
  `workspace:*` dependency.
- The `Parser` / `Generator` contracts drafted in
  [docs/architecture.md §Parsers / §Generators](../../../docs/architecture.md) are now
  concrete and differ from the sketch (`optionalDependsOn` added, `ParseContext<Options>`
  /`GenerateContext<Options>` type parameters dropped in favour of the config-system
  seam). `architecture.md` should be reconciled with this document once the feature lands
  (doc-only change, not part of this design phase).
- [ir-model/technical.md](../ir-model/technical.md) already anticipates this feature owning
  `mergeIR` and calling `assertIR`; no change needed there.
- `parser-prisma` / `generator-zod` / `generator-angular` overviews list "shape of the
  parser/generator contract" and "what the artifact exposes" as open questions — this
  document answers the core-facing half; the driver-internal half (Prisma type mapping,
  Zod export names, role vocabulary) stays in those features.
- [cli](../cli/overview.md) open questions "log/report format", "dry-run", "handling
  driver errors" now have primitives to build on: `RunResult`, `RunOptions.write`, the
  `TakoError` hierarchy.
- [config-system](../config-system/technical.md) now emits this `ResolvedConfig`
  (`@kurotako/config`, via `loadConfig()`): driver-options mechanism, `namespaces` and
  `hooks` syntax are settled there. It drove one **additive change to this document**:
  `ResolvedConfig.rootDir` (absolute config-file dir), consumed in step 1 as
  `ParseContext.cwd` — previously the step referenced an unsourced `cwd`. Task
  [#15](../../tasks/15-core-types-and-contracts.md) carries the field.
- [output-modes/technical.md](../output-modes/technical.md) drove several **additive
  changes** recorded above: `OutputConfig.packageManager?`, `GeneratorArtifact.peerDependencies?`
  (task #15); `VirtualFile.path` prefix is `<ns>/<generatorName>/`, `mergeTrees` guards a
  stray `<ns>/index.ts` (task [#19](../../tasks/19-core-collect.md)); `writer.ts` becomes
  the `writer/` directory, `selectWriter` gains the `packageWriter` branch and mode A
  writes `.gitattributes` (task [#20](../../tasks/20-core-writer.md)); `run.ts` gains steps
  5b (synthesize barrels) + 5c (`applyBanner`) and the mode-B `afterEmit.outputDir` (task
  [#21](../../tasks/21-core-run.md)); new errors `OutputPeerConflictError` /
  `PackageBuildError` / `PackageInstallError` (task #15). The "runtime dependency:
  `@kurotako/ir` only" rule is relaxed to allow a lazy `tsup` import on the mode-B path —
  the user chose in-core plumbing over a dedicated `@kurotako/output` package.

## Tests (vitest, colocated)

- `merge`: two sources merge; a `SourceIR` with a mismatched namespace rejects; a
  post-merge cross-source relation coherence failure surfaces as `IrValidationError`.
- `graph`: linear chain, diamond, `optionalDependsOn` present vs absent, missing hard dep,
  2- and 3-node cycles; tie-break follows config order.
- `filter`: single-namespace restriction drops the other sources; no restriction is a full
  clone; the clone is independent (mutating it does not touch the source IR).
- `collect`: collision between two generators; path escaping the root; output sorted.
- `directoryWriter`: wipes a pre-existing file not re-emitted; creates nested dirs;
  round-trips content; returns sorted absolute paths.
- `run` end to end with fake in-memory `Parser` / `Generator`: `write: false` produces
  `RunResult` and touches no disk; `afterEmit` fires once after a real write with the
  written paths; a generator throw becomes a `DriverError` naming it; `dependencies` holds
  only declared, present deps.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#15 core-types-and-contracts](../../tasks/15-core-types-and-contracts.md) — `src/types.ts`
   (config, driver contracts, contexts, artifacts, hooks, `Logger`, `RunOptions` /
   `RunResult`), `src/errors.ts` (`TakoError` hierarchy), `src/logger.ts`, barrel + `../ir`
   wiring (deps: #6, #11).
2. [#16 core-merge](../../tasks/16-core-merge.md) — `src/merge.ts` `mergeSources()`,
   namespace-mismatch / duplicate rejection, `assertIR` (deps: #15, #12).
3. [#17 core-graph](../../tasks/17-core-graph.md) — `src/graph.ts` `generatorOrder()`,
   Kahn, missing hard dep, cycle path (dep: #15).
4. [#18 core-filter](../../tasks/18-core-filter.md) — `src/filter.ts` `filterIR()`
   namespace-filtered deep clone (dep: #15).
5. [#19 core-collect](../../tasks/19-core-collect.md) — `src/collect.ts` `mergeTrees()`,
   path normalization, cross-generator collision (dep: #15).
6. [#20 core-writer](../../tasks/20-core-writer.md) — `src/writer/` (`types.ts`,
   `directory.ts` mode A + `.gitattributes` + unconditional wipe, `index.ts` `selectWriter`
   still throwing for `'package'`) (dep: #15). `writer/package.ts` / `barrel.ts` /
   `banner.ts` / `peers.ts` / `pm.ts` are added by [output-modes](../output-modes/technical.md).
7. [#21 core-run](../../tasks/21-core-run.md) — `src/run.ts` orchestrator wiring every
   step (incl. the 5b/5c barrel + banner seams) + `afterEmit` + end-to-end tests
   (deps: #15, #16, #17, #18, #19, #20).
