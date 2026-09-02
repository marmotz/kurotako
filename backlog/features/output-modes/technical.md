# Output modes (directory / npm package) — technical design

Design for how `tako` writes the generated tree to disk. Product decisions come from
[overview.md](overview.md); the writer seam, the virtual-file model and the artifact
contract live in
[core-pipeline/technical.md](../core-pipeline/technical.md#writer-seam) and the mode
selection in [ADR-0005](../../../docs/adr/0005-output-modes.md). This document turns the
overview into a concrete set of core modules, a barrel-synthesis step, a mode-B package
writer, and the list of amendments the decision "plumbing lives in `@kurotako/core`"
forces on already-written designs.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md)
  scaffolds `packages/core/`; [core-pipeline/technical.md](../core-pipeline/technical.md)
  turns it into the orchestrator with `src/writer.ts` holding a `Writer` interface and a
  `directoryWriter` (mode A), and `run.ts` step 6 selecting it. `output.mode: 'package'`
  currently throws `UnsupportedOutputModeError`
  ([core-pipeline/technical.md §Writer seam](../core-pipeline/technical.md#writer-seam)).
  This feature replaces that stub with the real mode-B path and adds barrel synthesis.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API** — disk access via `node:fs/promises`, subprocesses via
  `node:child_process`.
- Upstream contracts already designed:
  - [`@kurotako/core`](../core-pipeline/technical.md) — `Writer`, `directoryWriter`,
    `VirtualFile` (`{ path, content }`, generator owns the `<namespace>/` prefix),
    `GeneratorArtifact` / `EntitySymbols`, `OutputConfig`
    (`{ mode?, dir?, packagesDir?, scope? }`), `RunResult`, the `TakoError` hierarchy,
    `run.ts` steps 5 (collect) → 6 (write) → 7 (`afterEmit`).
  - [`@kurotako/config`](../config-system/technical.md) — resolves `output` to an absolute
    `dir` / `packagesDir`, defaults `{ mode: 'dir', dir: './generated/kurotako' }`,
    `NAMESPACE_RE = ^[a-z][a-zA-Z0-9]*$` (a namespace is a directory and an import-path
    segment).
  - [`@kurotako/gen-zod`](../generator-zod/technical.md) /
    [`@kurotako/gen-angular`](../generator-angular/technical.md) — each emits a per-entity
    file, shared files (`enums.ts`, `filters.ts`, a runtime helper) and **its own
    `index.ts` barrel**, today all directly under `<ns>/`. Each returns a
    `GeneratorArtifact` whose `EntitySymbols.module` and `extra.perNamespace[ns].*Module`
    are the specifiers a sibling generator / the consumer imports from.
- Relevant ADRs: [ADR-0004](../../../docs/adr/0004-ir-namespace-first.md) (deterministic
  identifiers, never namespace-prefixed; namespace drives output **location** only),
  [ADR-0005](../../../docs/adr/0005-output-modes.md) (modes A / B, identical module name),
  [ADR-0006](../../../docs/adr/0006-parser-generator-vocabulary.md).

## The collision this feature must resolve

`gen-zod` and `gen-angular` both emit `<ns>/index.ts`
([generator-zod/technical.md §File layout](../generator-zod/technical.md),
[generator-angular/technical.md §File layout](../generator-angular/technical.md)). Core's
`mergeTrees` rejects two generators writing the same path with `OutputCollisionError`
([core-pipeline/technical.md §Orchestration step 5](../core-pipeline/technical.md)). Two
generators active on one namespace is the nominal case (`gen-angular dependsOn: ['zod']`),
so this is a hard blocker, not an edge case.

### Decision — per-generator sub-tree + a synthesized namespace-root barrel

1. **Each generator owns `<ns>/<generatorName>/` as its prefix**, not `<ns>/`. `gen-zod`
   writes `<ns>/zod/user.schema.ts`, `<ns>/zod/enums.ts`, `<ns>/zod/index.ts`;
   `gen-angular` writes `<ns>/angular/user.form.ts`, `<ns>/angular/index.ts`. No two
   generators ever share a path. Each generator's own `index.ts` barrel stays its own
   responsibility and it decides what is public (overview decision).
2. **Core synthesizes `<ns>/index.ts`** per namespace, mechanically, from the artifacts:
   one `export * from './<generatorName>'` line per generator that contributed to that
   namespace, lines sorted by generator name. This is the "root synthesized" barrel — it
   lives in core because the writer seam and the artifact data both already do
   ([overview.md](overview.md) "plumbing in `@kurotako/core`").
3. **Fine-grained subpaths** need no synthesis: a wildcard `exports` / `paths` entry
   (`@kurotako/<ns>/*` → `<ns>/*`) exposes every emitted file
   (`@kurotako/pg/zod/user.schema`, `@kurotako/pg/angular/user.form`).

Import surface, identical in both modes:

```ts
import { UserDto }         from '@kurotako/pg'            // synthesized root barrel, re-exports every generator
import { UserDto }         from '@kurotako/pg/zod'        // one generator's barrel
import { UserFormFactory } from '@kurotako/pg/angular'
import { UserSchema }      from '@kurotako/pg/zod/user.schema'   // fine-grained, no eager sibling load
```

- **Name clashes in the root barrel**: two generators re-exporting the same identifier →
  TS/ESM treats an ambiguous star re-export as *not exported* (silent). Generated
  identifiers are role-distinct by design (`UserDto` vs `UserFormFactory`); a real clash is
  a generator-pair bug. Core logs a `warn` when it detects the same symbol name in two
  contributing artifacts' `entities[*].symbols` for one namespace, and still emits the
  barrel. Not an error (the fine-grained subpath is always an escape hatch).
- **Eager evaluation**: the root barrel does re-export everything, so importing from
  `@kurotako/pg` in a non-bundled Node/SSR context evaluates every generator's modules for
  that namespace. Accepted: it is opt-in (subpaths avoid it) and matches the ergonomics
  the architecture doc already advertises.

### Work-ordering consequence

The suggested feature order puts `output-modes` last, but the collision is real the moment
`generator-zod` and `generator-angular` run together (the `gen-angular` integration,
before `cli`). So this feature splits for scheduling:

- **Part 1 — barrel + banner** ([#48](../../tasks/48-output-root-barrel-and-banner.md)):
  `writer/barrel.ts`, `writer/banner.ts`, `run.ts` steps 5b/5c, the
  `<ns>/<generatorName>/` collision guard. A **dependency of**
  [#43](../../tasks/43-gen-angular-emit-artifact-run.md). (The `<ns>/<generatorName>/`
  prefix convention and the `peerDependencies` artifact field are folded into the
  generator tasks and #15 respectively — already amended.)
- **Part 2 — mode B** ([#49](../../tasks/49-output-peers-and-pm.md) +
  [#50](../../tasks/50-output-package-writer.md)): `writer/peers.ts`, `writer/pm.ts`,
  `writer/package.ts`, `tsup` dep, install. Can stay last; nothing depends on it until
  someone sets `output.mode: 'package'`.

### Alternatives considered

- **Named barrel per generator, no root** (`<ns>/zod.ts`, `<ns>/angular.ts`, drop
  `@kurotako/pg`). Rejected by the user: `import … from '@kurotako/pg'` must keep working.
- **Flat `<ns>/` + core synthesizes the single `index.ts`** (generators stop emitting any
  barrel, list public modules in the artifact). Rejected by the user in favour of full
  sub-trees: keeps each generator's output self-contained and independently browsable, and
  a generator can add non-entity files without a core-side allowlist.
- **`mergeTrees` merges same-path `index.ts` by concatenation.** Rejected: silently
  merging generator output breaks the "one generator owns each path" invariant core relies
  on for collision diagnostics, and ordering would be non-deterministic.

## Package shape (all in `@kurotako/core`)

Extends the module set from
[core-pipeline/technical.md §Package shape](../core-pipeline/technical.md#package-shape):

```
packages/core/src/
  writer/
    index.ts        # selectWriter(output): Writer   (replaces the flat writer.ts)
    types.ts        # Writer interface, WriteInput
    directory.ts    # directoryWriter — mode A (moved from writer.ts, unchanged behaviour)
    package.ts      # packageWriter  — mode B
    barrel.ts       # synthesizeRootBarrels(artifacts): VirtualFile[]   (mode-independent)
    banner.ts       # applyBanner(files): VirtualFile[]  +  GITATTRIBUTES const
    peers.ts        # collectPeerDependencies(artifacts): Record<ns, Record<pkg, range>>
    pm.ts           # resolvePackageManager(opts) + runInstall(pm, cwd)
    *.test.ts
```

New runtime dependencies of `@kurotako/core` — **this is the deviation the user accepted**
(core-pipeline locked "runtime dependency: `@kurotako/ir` only"):

| Dep | Kind | Why | Path |
|---|---|---|---|
| `tsup` | `dependencies` | programmatic `build()` of each generated package in mode B | mode B only |
| — | — | package-manager install via `node:child_process` (no dep) | mode B only |

Mode A pulls in **neither** — `directoryWriter` + `synthesizeRootBarrels` + `applyBanner`
stay dependency-free. `tsup` is loaded with a dynamic `import('tsup')` inside
`packageWriter` so a mode-A run never touches it (and a consumer who only uses mode A
still installs it as a transitive dep — acceptable, it is already the repo's build tool).

## `run.ts` amendments

Insert one step, extend one, extend the config type.

### `OutputConfig` (core `types.ts`, task [#15](../../tasks/15-core-types-and-contracts.md))

```ts
export interface OutputConfig {
  mode?: 'dir' | 'package'      // default 'dir'
  dir?: string                  // mode A, absolute (config-system)
  packagesDir?: string          // mode B, absolute
  scope?: string                // mode B, e.g. '@kurotako'
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm'   // mode B, optional (see §Package manager)
}
```

`@kurotako/config`'s structural schema and `OutputOption` type gain `packageManager`
(picklist, optional) — task [#23](../../tasks/23-config-schema.md) /
[#22](../../tasks/22-config-types-and-errors.md).

### `GeneratorArtifact` (core `types.ts`)

```ts
export interface GeneratorArtifact {
  entities: Record<string, EntitySymbols>
  peerDependencies?: Record<string, string>   // NEW: package -> semver range the emitted code imports
  extra?: unknown
}
```

- `gen-zod` sets `{ zod: '^3 || ^4' }` (matching its `zodVersion` option:
  `zodVersion: 4` → `'^4'`, `3` → `'^3'`).
- `gen-angular` sets `{ '@angular/core': '>=17', '@angular/forms': '>=17' }`, or `>=22`
  when the `signal` surface is emitted (exact ranges settled in
  [generator-angular/technical.md](../generator-angular/technical.md)).
- Absent / `{}` → the generator's output imports nothing external.
- Core does **not** read this in mode A (mode A does not emit a `package.json`).

### New orchestration step (between collect `#5` and write `#6`)

**5b. Synthesize root barrels** (`writer/barrel.ts`). Mode-independent.

`synthesizeRootBarrels(perGeneratorFiles, artifacts): VirtualFile[]`:

- For each namespace `ns` present in the collected tree, find the set of generator names
  that emitted at least one file under `<ns>/<name>/`.
- Emit `VirtualFile { path: '<ns>/index.ts', content }` where `content` is
  `export * from './<name>'\n` for each contributing generator name, **sorted**.
- A namespace with exactly one contributing generator still gets a root barrel (uniform;
  `@kurotako/pg` resolves regardless of how many generators ran).
- These synthesized files join the aggregated tree. A generator emitting `<ns>/index.ts`
  itself (i.e. not respecting the `<ns>/<name>/` prefix) now collides with the synthesized
  file → `OutputCollisionError` with a message pointing at the prefix rule. This is the
  new guard that enforces decision point 1.

Then existing step 5 ordering (sort by path) is re-applied to the union.

### Step 6 (write) — writer selection

`selectWriter(config.output)`:

- `mode` absent / `'dir'` → `directoryWriter`.
- `mode: 'package'` → `packageWriter`. No longer throws.
- anything else → `UnsupportedOutputModeError` (kept for a future mode).

Both writers receive the **banner-applied** tree: `run.ts` calls
`applyBanner(files)` (prepends the `// Generated by tako. Do not edit.` line, see
§Banner) before handing off, so every file — synthesized barrels included — carries it.

### Step 7 (`afterEmit`)

Unchanged trigger (only on `write: true`). `AfterEmitContext.outputDir` is
`config.output.dir` in mode A, `config.output.packagesDir` in mode B.
`AfterEmitContext.files` is the list of **source** files written (not mode-B `dist/`
output). In mode B the hook fires **after** the package build + install (they are part of
step 6, inside `packageWriter`).

## `directoryWriter` (mode A) — unchanged, one addition

Behaviour from
[core-pipeline/technical.md §Orchestration step 6](../core-pipeline/technical.md) is kept
verbatim (resolve `output.dir`, **unconditional wipe** `fs.rm(dir, { recursive: true,
force: true })`, recreate, write every file in sorted order, return absolute paths).

Addition: after writing the files, write `<dir>/.gitattributes` with the
`GITATTRIBUTES` constant (see §Banner). It is included in the returned path list and
therefore visible to `afterEmit`.

Mode A does **not**:

- touch the consumer's `tsconfig.json` (overview: "documents only"). The alias to add is
  surfaced by the CLI, once, after a successful mode-A run:
  `add to tsconfig.json → "paths": { "@kurotako/*": ["<relative dir>/*"] }`
  ([cli](../cli/overview.md) reporter concern; noted here, not built here).
- emit any `package.json`, `peerDependencies`, or build output.

## `packageWriter` (mode B)

`write({ files, output }): Promise<string[]>` where `output` carries `packagesDir`,
`scope`, `packageManager`.

Algorithm:

1. **Group** `files` by namespace (first path segment). Each namespace `ns` becomes one
   package.
2. **Per package directory**: `<packagesDir>/<scope-without-@>-<ns>/` (e.g.
   `packages/kurotako-pg/`). Matches
   [docs/architecture.md §Mode B](../../../docs/architecture.md). **Wipe + recreate** that
   directory (same exclusive-owner rule as mode A; a package dir `tako` did not create
   and that lacks the generated marker is refused — see §Accepted risks).
3. **Write sources** under `<pkgDir>/src/` (the `<ns>/` prefix is stripped: the namespace
   is now the package, so `<ns>/zod/user.schema.ts` → `src/zod/user.schema.ts`,
   `<ns>/index.ts` → `src/index.ts`).
4. **Emit `<pkgDir>/package.json`**:

   ```jsonc
   {
     "name": "<scope>/<ns>",
     "version": "0.0.0",              // frozen, never bumped (decision) — see §Versioning
     "type": "module",
     "main": "./dist/index.cjs",
     "module": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".":   { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" },
       "./*": { "types": "./dist/*.d.ts",     "import": "./dist/*.js",     "require": "./dist/*.cjs" }
     },
     "files": ["dist", "src"],
     "peerDependencies": { /* aggregated, see below */ },
     "sideEffects": false,
     "scripts": { "build": "tsup" },
     "//": "Generated by tako. Do not edit."
   }
   ```

   - `peerDependencies` = `collectPeerDependencies(artifacts)[ns]`
     (`writer/peers.ts`): union of every contributing generator's
     `artifact.peerDependencies`. **Conflict** (same package, two different ranges from two
     generators) → `OutputPeerConflictError { namespace, package, ranges, generators }`,
     fail-fast. Identical ranges de-duplicate. Rationale: generators rarely share a runtime
     dep; when they do, a silent pick is worse than a clear error the user resolves by
     pinning a generator option.
   - **`peerDependencies`, not `dependencies`** (overview): the consuming app provides
     `zod` / `@angular/*`; the generated package must not drag a second copy.
   - `exports` wildcard `./*` gives the fine-grained subpaths for free.
5. **Emit `<pkgDir>/tsconfig.json`** extending the repo preset
   (`{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" }, "include": ["src"] }`)
   and **`<pkgDir>/tsup.config.ts`** = `export { basePreset as default } from '../../tsup.config.base'`
   with `entry` overridden to every `src/**/*.ts` (so subpaths get their own `dist` files,
   not just the barrel). Both carry the banner as a leading comment.
6. **`.gitattributes`** at `packagesDir` root once (`<packagesDir>/.gitattributes`,
   `kurotako-*/** linguist-generated=true`) — plus, per package,
   `<pkgDir>/.gitattributes` (`* linguist-generated=true`) so a package moved out of the
   monorepo keeps the marker.
7. **Build**: `const { build } = await import('tsup')`; run it per package
   (`entry: src/**/*.ts`, `format: ['esm', 'cjs']`, `dts: true`, `outDir: dist`,
   `silent: true`). A build failure → `PackageBuildError { namespace, cause }`.
8. **Install** (once, after every package is written + built): resolve the package
   manager (§Package manager), run `<pm> install` with `cwd` = the workspace root
   (nearest ancestor of `packagesDir` containing a `package.json` with a `workspaces` /
   `pnpm-workspace.yaml`, else `packagesDir`). A non-zero exit →
   `PackageInstallError { pm, cause }`. Skipped when no package manager can be resolved
   **and** none is configured — a `warn` prints the command to run.
9. Return the sorted list of absolute **source** paths written (steps 3–6). `dist/` is not
   in the list (it is a build product, and `drift-guard` diffs sources).

### Determinism

- Packages iterated in sorted-namespace order; files sorted by path; `package.json` keys
  in the fixed order above; `peerDependencies` keys sorted.
- `version: "0.0.0"` is constant — a re-`generate` produces a byte-identical
  `package.json` (required by [drift-guard](../drift-guard/overview.md), which will need to
  ignore `dist/` — noted for that feature).
- The tsup build is a downstream product; `drift-guard` compares `src/` + `package.json` +
  config files only.

## Versioning (mode B)

**`version: "0.0.0"`, frozen, `tako` never writes anything else** (decision). Real
versioning is the consumer's job (changesets, `workspace:*` resolution ignores the value).
Re-running `tako generate` never bumps it. No `output.version` field, no content hash.

Consequence: a generated package cannot be `npm publish`ed as-is to a public registry
without the consumer setting a version first — acceptable, mode B targets monorepos /
private registries with their own release tooling
([ADR-0005](../../../docs/adr/0005-output-modes.md) "independent versioning" is the
consumer's, not `tako`'s).

## Package manager (mode B)

`resolvePackageManager({ output, startDir })` (`writer/pm.ts`), in order:

1. `output.packageManager` if set → use it verbatim.
2. Walk up from `packagesDir` looking for a lockfile:
   `bun.lock` / `bun.lockb` → `bun`; `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`;
   `package-lock.json` → `npm`. First hit wins. Stop at `.git` or filesystem root.
3. Nearest ancestor `package.json` with a `packageManager` field
   (`"packageManager": "pnpm@9.x"`) → the name before `@`.
4. Nothing resolved → **do not guess**: skip the install, `warn` with the manual command
   (`run '<your package manager> install' to link the generated packages`).

`runInstall(pm, cwd)`: `execFile(pm, ['install'], { cwd })` via
`node:child_process` (promisified), inheriting stdio at `debug` level, captured otherwise.
No `--frozen-lockfile` (the generated packages are new, the lockfile must change).

### Alternatives considered

- **Always default to `npm`** when nothing is detected. Rejected: running the wrong
  package manager in a `pnpm` / `bun` workspace corrupts `node_modules`; a printed command
  is safer than a wrong guess.
- **`corepack`**. Rejected for v1: adds a moving part and is being de-bundled from Node;
  the lockfile + `packageManager` field cover the real cases.
- **Never install, always print** (revert the overview "auto-install"). Rejected — the
  user kept auto-install; step 4 above is the conservative fallback within that decision.

## Banner (`writer/banner.ts`)

```ts
export const BANNER = '// Generated by tako. Do not edit.\n'
export const GITATTRIBUTES = '* linguist-generated=true\n'
export function applyBanner(files: VirtualFile[]): VirtualFile[]
```

- `applyBanner` prepends `BANNER` to every `.ts` / `.tsx` file. For `.json`
  (`package.json`) there is no comment syntax → the `"//"` key carries it (set by
  `packageWriter`, not `applyBanner`). `tsconfig.json` / `tsup.config.ts` get the comment
  form.
- Applied in `run.ts` **after** barrel synthesis, **before** the writer — one call site,
  covers generator output and synthesized barrels alike.
- Generators therefore **stop worrying about the banner** (they already do not add it —
  [generator-zod/technical.md §Determinism](../generator-zod/technical.md),
  [generator-angular/technical.md](../generator-angular/technical.md)). Confirmed: no
  generator change needed for the banner.
- The banner text is constant (no timestamp, no version) — determinism preserved.

## Errors (core `errors.ts`, all extend `TakoError`)

| Class | `code` | Thrown when |
|---|---|---|
| `OutputCollisionError` (exists) | `output_collision` | now also fires when a generator emits `<ns>/index.ts` instead of `<ns>/<name>/…` |
| `OutputPeerConflictError` | `output_peer_conflict` | two generators declare the same peer dependency with different ranges for one namespace |
| `PackageBuildError` | `package_build_error` | the tsup build of a generated package fails (wraps `cause`, names the namespace) |
| `PackageInstallError` | `package_install_error` | the package-manager `install` exits non-zero (wraps `cause`, names the pm) |
| `OutputNotGeneratedError` | `output_not_generated` | mode B target `<pkgDir>` exists, is non-empty, and its `package.json` lacks the `"//": "Generated by tako…"` marker (wipe guard) |
| `UnsupportedOutputModeError` (exists) | `unsupported_output_mode` | `output.mode` is neither `'dir'` nor `'package'` |

The CLI already maps any `TakoError` to a formatted line + exit 1
([cli/technical.md §Errors](../cli/technical.md)); these need no CLI change.

## Consequences — amendments this feature forces

### `core-pipeline/technical.md` (tasks [#15](../../tasks/15-core-types-and-contracts.md), [#19](../../tasks/19-core-collect.md), [#20](../../tasks/20-core-writer.md), [#21](../../tasks/21-core-run.md))

- **Runtime-dependency rule relaxed**: `@kurotako/core` gains `tsup` (`dependencies`),
  loaded lazily and only on the mode-B path. The "`@kurotako/ir` only" line in §Package
  shape must be reworded to "`@kurotako/ir` at all times; `tsup` lazily for mode B".
  `node:child_process` is used (mode B install). **The user chose this over a dedicated
  `@kurotako/output` package** — revisit if core's install surface becomes a problem.
- `OutputConfig` gains `packageManager?`.
- `GeneratorArtifact` gains `peerDependencies?`.
- `run.ts`: new **step 5b** (synthesize root barrels), `applyBanner` call before step 6,
  `selectWriter` now returns `packageWriter` for `mode: 'package'`, `afterEmit.outputDir`
  is `packagesDir` in mode B.
- `writer.ts` becomes the `writer/` directory above.
- New error classes listed §Errors.

### `generator-zod/technical.md` (tasks [#32](../../tasks/32-gen-zod-scaffold.md), [#35](../../tasks/35-gen-zod-emit-enums-filters.md), [#36](../../tasks/36-gen-zod-emit-entity-barrel.md), [#37](../../tasks/37-gen-zod-artifact-and-run.md))

- **Path prefix**: every `VirtualFile.path` moves from `<ns>/…` to `<ns>/zod/…`
  (`<ns>/zod/enums.ts`, `<ns>/zod/filters.ts`, `<ns>/zod/<entity>.schema.ts`,
  `<ns>/zod/index.ts`).
- **Module specifiers** follow: `<ns>/zod/<entity>.schema`, `<ns>/zod/enums`,
  `<ns>/zod/filters`, `<ns>/zod` (own barrel). `EntitySymbols.module` and
  `ZodArtifactExtra.perNamespace[ns].{enumsModule,filtersModule,barrelModule}` change
  value accordingly (the indirection is exactly why sibling generators read the artifact
  and not hard-coded paths — no `gen-angular` code change, only the value it receives).
- `artifact.peerDependencies = { zod: <range from zodVersion> }`.
- The generator keeps emitting its **own** `<ns>/zod/index.ts`; it no longer needs to
  worry about colliding with `gen-angular`.

### `generator-angular/technical.md` (tasks [#38](../../tasks/38-gen-angular-scaffold.md), [#43](../../tasks/43-gen-angular-emit-artifact-run.md))

- **Path prefix** `<ns>/angular/…` (`<ns>/angular/<entity>.form.ts`,
  `<ns>/angular/zod-forms.runtime.ts`, `<ns>/angular/index.ts`).
- It imports Zod symbols from `ZodArtifactExtra.perNamespace[ns].barrelModule` /
  `enums['…'].module` — now `<ns>/zod` / `<ns>/zod/enums`. It already reads these from the
  artifact, so the change is a value change, not a code change.
- `artifact.peerDependencies = { '@angular/core': …, '@angular/forms': … }`.

### `config-system/technical.md` (tasks [#22](../../tasks/22-config-types-and-errors.md), [#23](../../tasks/23-config-schema.md), [#25](../../tasks/25-config-load.md))

- `OutputOption` type (#22) + `TakoConfigSchema` (#23) gain
  `packageManager: v.optional(v.picklist(['bun','pnpm','yarn','npm']))`.
- `output.mode === 'package'` cross-field check in `load.ts` (#25) already requires
  `packagesDir` ([config-system/technical.md §Loading](../config-system/technical.md)); add
  `scope` to the **required** set for mode B (the `package.json` `name` is
  `${scope}/${namespace}`) → `ConfigShapeError` when `scope` is missing.
- `load.ts` passes `scope` / `packageManager` through to `ResolvedConfig.output` (#25).

### `monorepo-bootstrap/technical.md` (task [#6](../../tasks/6-package-skeletons.md))

- `packages/core/package.json` skeleton lists `tsup` under `dependencies` (it is already a
  root devDependency; core promotes it). No new package skeleton — the "dedicated
  `@kurotako/output` package" alternative was **rejected** by the user.

### `docs/architecture.md` (doc-only, not this phase)

- §"Namespaces and output": the mode-A tree becomes
  `generated/kurotako/pg/{index.ts, zod/…, angular/…}`; the `import { UserDto } from '@kurotako/pg'`
  example still holds (synthesized root barrel).
- §"Mode B": `tako` build step is explicit (tsup), `version` is `0.0.0`.

### `drift-guard/overview.md` (noted for that feature)

- Mode B: `drift-guard` must diff `src/` + `package.json` + generated config files and
  **ignore `dist/`** (a build product). Mode A is unaffected.

## What stays out of this feature

- **The virtual-file model, `mergeTrees`, collision detection, `directoryWriter`'s wipe
  semantics** — [core-pipeline](../core-pipeline/technical.md) (this feature extends, does
  not redefine them).
- **The per-entity file content, variant matrix, artifact `extra` shape** —
  [generator-zod](../generator-zod/technical.md) /
  [generator-angular](../generator-angular/technical.md) (this feature only relocates the
  path prefix and adds `peerDependencies`).
- **`tsconfig` alias auto-editing** — explicitly rejected (overview): the CLI prints it.
- **`tako publish` / registry push / real version numbers** — the consumer's release
  tooling.
- **Incremental / partial regeneration of a single package** — [cli](../cli/overview.md)
  owns execution model; v1 wipes and regenerates every package.

## Accepted risks

- **`@kurotako/core` runs a build tool and a package manager.** A mode-B `tako generate`
  spawns `tsup` (in-process) and `<pm> install` (subprocess). This widens core's blast
  radius well beyond the "pure orchestration + one I/O site" it was scoped to. Mitigations:
  both are mode-B only and lazily loaded; `PackageBuildError` / `PackageInstallError` wrap
  failures with context; `--dry-run` (`write: false`) skips the whole writer. Revisit
  extracting `@kurotako/output` if this proves painful.
- **Mode-B package-dir wipe.** Like mode A, `packageWriter` wipes `<pkgDir>` before
  writing. A user pointing `packagesDir` at a directory holding hand-written packages with
  a colliding `kurotako-<ns>` name loses that package. Guard: refuse a target `<pkgDir>`
  that exists, has no `"//": "Generated by tako…"` marker in its `package.json`, and is
  non-empty → **`OutputNotGeneratedError`** (new `TakoError` subclass, defined by the
  mode-B `packageWriter` task).
- **Auto-install side effect.** `tako generate` mutating `node_modules` / the lockfile is
  surprising for a codegen tool. It only happens in mode B, only when a package manager is
  resolved, and the overview explicitly asked for it. `output.packageManager` +
  the print-only fallback bound the surprise.
- **Ambiguous star re-export in the root barrel** silently drops a symbol exported by two
  generators under the same name. Detected and `warn`-logged; fine-grained subpaths are the
  escape hatch.

## Tests (vitest, colocated)

- `barrel.ts`: two generators on one namespace → one `<ns>/index.ts` with two sorted
  `export *` lines; single generator → still a root barrel; a generator emitting
  `<ns>/index.ts` directly → `OutputCollisionError`; same symbol in two artifacts → `warn`,
  barrel still emitted.
- `banner.ts`: `.ts` gets the `//` line prepended; `package.json` untouched by
  `applyBanner`; idempotent-safe (not run twice); constant output.
- `peers.ts`: union of two disjoint peer sets; identical range de-dupes; conflicting ranges
  → `OutputPeerConflictError` naming both generators.
- `pm.ts`: `output.packageManager` wins; `bun.lockb` two dirs up → `bun`; `packageManager`
  field fallback; nothing → returns `null`, no throw.
- `directoryWriter`: writes `.gitattributes`; unchanged wipe/round-trip behaviour (existing
  tests move under `writer/`).
- `packageWriter` (temp dir, `tsup` build stubbed / real on a tiny fixture):
  - one namespace → `packages/<scope>-<ns>/` with `src/`, `package.json` (`name`,
    `version: "0.0.0"`, sorted `peerDependencies`, `exports`), `tsconfig.json`,
    `tsup.config.ts`, `.gitattributes`;
  - `<ns>/` prefix stripped from `src/` paths;
  - `scope` missing → surfaced as a config error upstream (config-system test), not here;
  - build failure → `PackageBuildError`;
  - install invoked once with the resolved pm and workspace-root cwd; `PackageInstallError`
    on non-zero exit; skipped + `warn` when pm unresolved;
  - returned path list is sorted source paths, no `dist/`.
- `run.ts` (mode B, fake generators): end-to-end produces packages, `afterEmit` sees
  `packagesDir` and source paths; `write: false` produces `RunResult` and spawns nothing.
- determinism: same IR + config → byte-identical `package.json` and barrels on a second
  run.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`. The
`OutputConfig.packageManager` / `GeneratorArtifact.peerDependencies` / mode-B error
classes (#15), the `<ns>/<generatorName>/` path prefix (#32/#36/#37/#38/#43), the config
`packageManager` + mode-B `scope` requirement (#22/#23/#25) and the core `tsup` dependency
(#6) are **amendments already folded into those existing tasks/issues** — not repeated
here.

1. [#48 output-root-barrel-and-banner](../../tasks/48-output-root-barrel-and-banner.md) —
   `writer/banner.ts` (`BANNER` / `GITATTRIBUTES` / `applyBanner`), `writer/barrel.ts`
   (`synthesizeRootBarrels`), `run.ts` steps 5b + 5c, the stray-`<ns>/index.ts` collision
   guard (deps: #15, #19, #21). **Dependency of #43.**
2. [#49 output-peers-and-pm](../../tasks/49-output-peers-and-pm.md) — `writer/peers.ts`
   (`collectPeerDependencies`, `OutputPeerConflictError`), `writer/pm.ts`
   (`resolvePackageManager`, `runInstall`, `PackageInstallError`) (dep: #15).
3. [#50 output-package-writer](../../tasks/50-output-package-writer.md) —
   `writer/package.ts` (`packageWriter`: `package.json`, `exports`, `peerDependencies`,
   tsconfig/tsup, `.gitattributes`, tsup build, install, `OutputNotGeneratedError` wipe
   guard), `selectWriter` `'package'` branch, `tsup` in `core` deps, mode-B
   `afterEmit.outputDir` (deps: #15, #20, #21, #25, #48, #49).
