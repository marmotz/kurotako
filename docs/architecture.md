# Architecture

## Overview

```
[ parsers (1..N) ]  ->  [ global IR ]  ->  [ generators (0..N) ]  ->  [ output ]
   parser-prisma          map of             gen-zod                        mode A: directory
   parser-mongoose        namespaces         gen-angular (private gen-zod)   mode B: package/source
```

No fixed 3-stage pipeline. Only two driver roles:

- **`parser`**: reads a schema source and produces a **partial IR** under a namespace.
- **`generator`**: consumes the IR (global or filtered) plus the artifacts of its private dependencies, and writes code.

The `core` orchestrates: instantiates the parsers, merges the partial IRs, runs the generators in declaration order
(each one preceded by its private dependencies), feeds each its input, collects the artifacts.

## Parsers

- Several parsers active simultaneously.
- A source's **config key** is its **namespace** (`pg`, `mongo`, `crm`...).
- The source's `use` field designates the parser object (`prismaParser`, …). The same package can be instantiated
  several times under different namespaces (two `schema.prisma` files).
- `parser-prisma` accepts Prisma 7 schemas through DMMF and Prisma 8 PostgreSQL
  `contract.json` artifacts. In contract mode, one Prisma contract is flattened into one
  kurotako source namespace; `rename` and `namespacePrefix` resolve model names before IR
  construction, and unresolved collisions fail rather than silently selecting a model.
- Config shape (user-facing, `defineConfig`): each source is
  `{ use: <parser>, options?: { … } }`. `@kurotako/config` validates `options` against the parser's Valibot
  `optionsSchema` and **curries the argument away**; `@kurotako/core` only ever sees the single-argument contract below.
- Contract (`@kurotako/core`):

  ```ts
  interface Parser {
    name: string                                                 // "prisma"
    parse(ctx: ParseContext): Promise<SourceIR> | SourceIR
    watchPaths?(ctx: ParseContext): string[] | Promise<string[]> // metadata for `tako generate --watch`; run() never calls it
    anchor?(rootDir: string): string | undefined | Promise<string | undefined> // monorepo: where this source's schema lives
  }

  interface ParseContext {
    namespace: string
    cwd: string           // absolute; the config-file directory
    anchorDir?: string     // absolute; where the schema lives (from `anchor()`), for toolchain-dependency resolution
    logger: Logger
  }
  ```

## IR

See [ir.md](ir.md). Structural points:

- Keyed `(namespace, entity)`. `pg.User` and `mongo.User` are two distinct entities, never merged.
- The core rejects two sources declaring the same namespace; there is no entity collision since the namespace isolates
  them.
- Source / target agnostic: it must carry types, constraints (required/optional, length, regex, min/max, enum),
  relations, and stay reusable for future generators (OpenAPI, SDK, factories).

## Generators and private dependencies

- Generators run in **declaration order**. There is no dependency graph between config entries: no name-based
  `dependsOn`, no topological sort, no cycle detection across entries.
- A generator that needs another generator's output declares it as a **private dependency**: a descriptor
  `{ use: <driver>, options? }` (a config entry without `namespaces`). Core runs a **private instance** of the
  dependency for that dependent alone, before it, on the same namespace-filtered IR, and hands its artifact over as
  `ctx.dependencies[<dependency name>]`. Two dependents get two independent copies.
- A generator receives the namespace-filtered IR plus, for each private dependency, a structured artifact handle
  (`GeneratorArtifact`, below) — never raw file paths.
- Options are curried away by `@kurotako/config` exactly as for parsers, dependencies included (a dependency's
  options are validated against its own `optionsSchema`); core sees the single-argument contract and already-curried
  dependencies:

  ```ts
  interface Generator {
    name: string                       // "angular"
    dependsOn?: Generator[]            // private, already-curried dependencies
    generate(ctx: GenerateContext): Promise<GenOutput> | GenOutput
  }

  interface GenerateContext {
    ir: IR                                          // namespace-filtered deep clone of the merged IR
    dependencies: Record<string, GeneratorArtifact> // artifact of each private dependency, by driver name
    cycles: Set<string>                             // `${namespace}.${name}` of every ref-cycle member
    segment: string                                 // sub-tree under `<namespace>/` to emit into and import from
    logger: Logger
  }

  interface GenOutput { files: VirtualFile[]; artifact: GeneratorArtifact }
  ```

- Author side (`@kurotako/config`): `dependsOn` is `readonly { use, options? }[]`, or a function
  `(options) => readonly { use, options? }[]` receiving the generator's validated options, so the dependency's options
  can derive from them. `gen-angular` declares `dependsOn: (options) => [{ use: zodGenerator, options: { zodVersion:
  options.zodVersion } }]`. A dependency chain may nest; a cycle (reachable only through the function form) is
  rejected at load with `DependencyCycleError`. The removed name-based form (strings, `optionalDependsOn`) is rejected
  with `LegacyDependencyError`.
- There is **no** "generate its own `Validators` from the IR" fallback — Zod is the single source of validation
  truth, and the generated Angular forms delegate to it (`zodValidator(schema)`).

### Private instances and their output

- **Segment.** A top-level generator emits into `<namespace>/<generatorName>/` (`ctx.segment === name`). A private
  instance gets the nested segment `<parent segment>/<dependency name>` (`angular/zod`), so its files land in
  `<namespace>/angular/zod/`. A generator used as a dependency builds its file prefix **and every module specifier it
  publishes in its artifact** (`entities[*].module`, `extra`) from `ctx.segment`, never from a hardcoded name; core
  cannot rewrite the opaque `extra`. `gen-zod` is the reference implementation.
- **Segment guard.** Core rejects a private instance that emits outside `<namespace>/<segment>/`
  (`SegmentViolationError`, code `segment_violation`).
- **Attribution.** Private files belong to the dependent: `outputs[].generators: ['angular']` keeps
  `<ns>/angular/zod/**`, and the drift-guard (`tako check`) covers them.
- **Invisible root barrel.** The synthesized `<namespace>/index.ts` re-exports `<generator>/index.ts` only, and
  `angular/index.ts` does not export `zod/`, so a private copy never collides with a user `zod` entry and raises no
  ambiguity warning. It stays reachable by subpath (`@kurotako/pg/angular/zod/User.schema`). A user who keeps a `zod`
  entry next to `angular` simply gets two copies.
- **Artifacts.** A private artifact is not in `RunResult.artifacts`. Its `peerDependencies` are merged into the
  dependent's artifact (identical ranges de-duplicate; two ranges for one package throw `OutputPeerConflictError`
  naming the dependent), so mode B declares them once on the namespace package. Its files ship in the same
  per-namespace package (`src/angular/zod/...`).
- **Errors.** A private instance that throws is a `DriverError` naming the instance and its dependent
  (`dependencyOf`).

### Artifact handle (`GeneratorArtifact`)

```ts
interface GeneratorArtifact {
  entities: Record<string, EntitySymbols>   // key === `${namespace}.${entity}`
  peerDependencies?: Record<string, string> // package -> semver range the emitted code imports (mode B: aggregated per namespace)
  extra?: unknown                           // generator-defined; the consumer casts to the producer's published type
}

interface EntitySymbols {
  module: string                    // module specifier a sibling generator imports from
  symbols: Record<string, string>   // role -> exported identifier, e.g. { schema: "UserSchema", type: "User" }
}
```

A dependent reads `ctx.dependencies.zod.entities['pg.User'].symbols.schema`, never a raw path — this is what decouples
`gen-angular` from `gen-zod`'s output tree.

## Namespaces and output

- The namespace **never changes the generated identifiers**: the entity `User` always produces `UserDto`, `UserSchema`,
  `UserForm`, whether the config has 1 or 10 sources.
- The namespace drives the **location**: one directory / submodule per source, named after the config key.
- Disambiguation through the import path:

  ```ts
  import { UserDto } from '@kurotako/pg'
  import { UserDto as MongoUserDto } from '@kurotako/mongo'
  ```

The config file is `tako.config.ts` (typed, `defineConfig` from `kurotako`). `output` is the plural `outputs` array —
one entry per destination, each optionally narrowed with `generators: ['zod', …]`.

### Mode A — directory (default)

```ts
// tako.config.ts
import { defineConfig } from 'kurotako'

export default defineConfig({
  outputs: [{ dir: './generated/kurotako' }],
})
```

```
generated/kurotako/
  pg/
    index.ts           # synthesized by tako: re-exports every generator's sub-tree
    zod/     index.ts  enums.ts  filters.ts  User.schema.ts
    angular/ index.ts  zod-forms.runtime.ts  User.form.ts
  mongo/
    index.ts
    zod/     index.ts  User.schema.ts
```

Each generator owns a `<namespace>/<generatorName>/` sub-tree; `tako` synthesizes the
`<namespace>/index.ts` root barrel. It re-exports every generator; if their public names
collide, the lexically first generator owns that root export deterministically, and `tako`
prints one plain-language warning per namespace explaining which import yields which
declaration. Import a generator subpath to select the other declaration. Import by relative path or tsconfig alias
`@kurotako/*` → `./generated/kurotako/*` (`@kurotako/pg` hits the root barrel,
`@kurotako/pg/zod` one generator, `@kurotako/pg/zod/user.schema` one file). `tako generate`
is enough, nothing to publish or install; every file carries a
`// Generated by tako. Do not edit.` banner. See
[output-modes](../backlog/_archives/features/output-modes/technical.md).

### Mode B — npm package per source

```ts
// tako.config.ts
import { defineConfig } from 'kurotako'

export default defineConfig({
  outputs: [{
    mode: 'package',
    packagesDir: './packages',
    scope: '@kurotako',
    packageManager: 'bun',   // optional; auto-detected from the lockfile otherwise
  }],
})
```

```
packages/
  kurotako-pg/    package.json ({ "name": "@kurotako/pg", "version": "0.0.0" })  src/  dist/  tsup.config.ts
  kurotako-mongo/ package.json ({ "name": "@kurotako/mongo", "version": "0.0.0" })
```

Standard node resolution, no `paths` config. Suited to monorepo / private registry / independent versioning. `tako`
generates one `package.json` per source (frozen `version: "0.0.0"`, never bumped by `tako`; runtime libs aggregated as
`peerDependencies`) plus a `tsup.config.ts` extending the workspace base preset, runs an **explicit `tsup` build** per
package (`dist` + types), and triggers the detected package manager's `install` on the first `generate`. The consumer
declares the dependency (`workspace:*`) and owns real versioning (changesets). See
[output-modes](../backlog/_archives/features/output-modes/technical.md).

The module name (`@kurotako/pg`) is identical in both modes; only the resolution plumbing changes.

## CLI

`tako` binary (citty command tree). Final command set:

```
tako init     [--config <path>] [--force] [--monorepo | --no-monorepo]
tako generate [--config <path>] [--watch] [--dry-run]
tako validate [--config <path>]
tako check    [--config <path>]              # drift guard — post-v1
```

`--config <path>` is the one global option (spread into every command); `--debug` (or `TAKO_DEBUG`) switches the
reporter to verbose. `tako init` writes `import { defineConfig } from 'kurotako'` and picks between the plain and the
workspace-aware template (`--monorepo` forces it, otherwise auto-detected). Incremental regeneration: out of scope for
v1 — every `generate` is a full parse + full generate + full wipe.

Projects install the single umbrella package **`kurotako`**, which provides the `tako`
binary and re-exports `defineConfig` (`import { defineConfig } from 'kurotako'`). It is an
umbrella over `@kurotako/cli` (the binary and its programmatic `runCli` API) and
`@kurotako/config` (`defineConfig` plus the config loader/validator); both scoped packages
stay published for advanced use. The meta `tako` bin owns `--version` (reporting the
installed `kurotako` version) and delegates everything else to `@kurotako/cli` unchanged.

`tako check` (drift guard) regenerates in memory and compares the result against the
committed output tree — exit 0 in sync, exit 1 (with the list of `modified` / `missing` /
`orphan` files) on any divergence. It relies on generators emitting byte-deterministic,
already-formatted code: it does **not** run the `afterEmit` hook, so a project that
formats generated code through an `afterEmit` Biome/Prettier hook would see `tako check`
report spurious drift. `afterEmit` formatting is a `generate`-path convenience only. See
[drift-guard](../backlog/_archives/features/drift-guard/technical.md).
