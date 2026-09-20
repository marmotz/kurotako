# Implicit generator dependencies — technical design

Product decisions: [overview.md](overview.md). Cross-cutting model:
[docs/architecture.md](../../../docs/architecture.md) (generators and DAG, artifact handle,
namespaces and output).

## Current state (verified)

- A generator declares `dependsOn?: string[]` and `optionalDependsOn?: string[]`, by name, on three
  parallel types: core `Generator` ([types.ts:114](../../../packages/core/src/types.ts)), config
  `TakoGenerator` ([types.ts:49](../../../packages/config/src/types.ts)) and `defineGenerator`
  ([define-driver.ts:47](../../../packages/config/src/define-driver.ts)). `load.ts` copies both arrays
  as is ([load.ts:180](../../../packages/config/src/load.ts)).
- Core orders generators with `generatorOrder` (Kahn, ties broken by declaration order): a hard name
  absent from `config.generators` throws `UnknownDependencyError`, a name in both arrays
  `InvalidDependencyError`, a loop `DependencyCycleError`
  ([graph.ts:15](../../../packages/core/src/graph.ts),
  [errors.ts:62-100](../../../packages/core/src/errors.ts)). `run.ts` calls it at step 3
  ([run.ts:84](../../../packages/core/src/run.ts)) and exposes the order as `RunResult.order`
  ([types.ts:212](../../../packages/core/src/types.ts)); nothing outside `run.ts` reads `order`.
- `run.ts` step 4 builds `ctx.dependencies` from `artifacts[depName]` for every declared name that ran
  ([run.ts:95-108](../../../packages/core/src/run.ts)) and hands the generator a namespace-filtered IR
  ([run.ts:93](../../../packages/core/src/run.ts)). Config entries are unique by `use.name`
  ([load.ts:96-105](../../../packages/config/src/load.ts)); the config key is the driver name, there is
  no per-entry alias.
- Only `gen-angular` uses `dependsOn` (`['zod']`) and reads `ctx.dependencies.zod`
  ([generator.ts:19-28](../../../packages/gen-angular/src/generator.ts)). `gen-zod`, `gen-typescript` and
  `gen-openapi` declare none. `gen-angular` lists `@kurotako/gen-zod` as a peer dependency
  ([package.json:54-57](../../../packages/gen-angular/package.json)).
- Output layout is path-driven: a generator owns `<namespace>/<generatorName>/`. Everything downstream
  derives the generator from `path.split('/')[1]`: the per-output filter
  ([run.ts:141-148](../../../packages/core/src/run.ts)), `contributingGenerators`
  ([tree.ts](../../../packages/core/src/writer/tree.ts)), the root barrel (reads
  `<ns>/<gen>/index.ts` only, [barrel.ts:169-171](../../../packages/core/src/writer/barrel.ts)) and mode B
  peer aggregation, which looks up `artifacts[<gen>].peerDependencies`
  ([peers.ts:34](../../../packages/core/src/writer/peers.ts)).
- Cross-generator imports use the artifact's `module` string verbatim as a bare specifier
  (`tasks/zod/Task.schema`), resolved by a tsconfig alias in mode A and a `paths` self-reference in mode B
  ([package.ts:354-379](../../../packages/core/src/writer/package.ts)). The `zod` segment appears in
  `gen-zod` in exactly two kinds of places: the file prefix `${namespace}/zod`
  ([generator.ts:30](../../../packages/gen-zod/src/generator.ts)) and the artifact-facing module functions
  ([names.ts:102-125](../../../packages/gen-zod/src/names.ts)), fed into `entities[*].module` and
  `extra.perNamespace[*]` ([artifact.ts:89-143](../../../packages/gen-zod/src/artifact.ts)). Imports
  between `gen-zod`'s own files are relative (`jsFile('./enums')`, for example
  [entity.ts:446](../../../packages/gen-zod/src/emit/entity.ts)), so they survive a segment change.
- `extra` is opaque to core, so core cannot rewrite the module strings inside it.
- Related backlog: issue #197 (`dependsOn` computed from options) and the `gen-react-tanstack` design,
  which planned it as an interim ([technical.md](../generator-react-tanstack/technical.md)); the package
  does not exist yet.

## Design

### 1. Contract: `dependsOn` carries curried generators

`@kurotako/config` declares the author-facing form, `@kurotako/core` receives the resolved form.

Author side (`define-driver.ts`, `types.ts`):

```ts
// A dependency descriptor: a config GeneratorEntry without `namespaces`.
type GeneratorDependency<D = TakoGenerator<any>> = { use: D } & OptionsMember<D>;

interface TakoGenerator<O = void> {
  name: string;
  dependsOn?:
    | readonly GeneratorDependency[]
    | ((options: O) => readonly GeneratorDependency[]);
  optionsSchema?: v.GenericSchema<unknown, O>;
  generate(ctx: GenerateContext, options: O): GenOutput | Promise<GenOutput>;
}
```

- `optionalDependsOn` is removed from all three types.
- The function form receives the validated options Output, like `generate`, so a dependent can fix the
  private instance's options from its own (this absorbs #197). `defineGenerator` types the function
  parameter as `DriverOptions<S>`.
- The descriptor reuses `OptionsMember`, so the dependency's options are type-checked against its own
  `optionsSchema` (required vs optional options behave exactly like a config entry).

Core side (`types.ts`): `Generator.dependsOn?: Generator[]`, the already-curried private generators
(name = driver name, options bound). Core never sees options or descriptors, mirroring how parsers and
generators are curried today ([load.ts:180-187](../../../packages/config/src/load.ts)).

### 2. Resolution in `@kurotako/config`

`load.ts` gets a recursive `curryGenerator(use, options, ancestry)` used for top-level entries and for
dependencies:

1. Validate `options` against `use.optionsSchema` (`parseDriverOptions`). For a dependency the
   `DriverOptionsError` message names the dependent (new optional `via` argument: `invalid options for
   generator 'zod' (required by 'angular'): ...`).
2. Resolve `use.dependsOn` (call the function with the validated options; a throw or a non-array result
   becomes a `ConfigShapeError` naming the generator).
3. Curry each descriptor recursively, then build the core `Generator`
   `{ name, dependsOn: curried, generate: (ctx) => use.generate(ctx, options) }`.

New config errors (all `TakoError` subclasses in `config/src/errors.ts`):

- `DuplicateDependencyError(generator, dependency)`: two descriptors of the same driver name in one
  `dependsOn` (they would share the `ctx.dependencies` key and the segment).
- `DependencyCycleError(path)`: a driver name repeats in its own ancestry (reachable only through
  function-form `dependsOn`). Replaces the deleted core class of the same name (same code
  `dependency_cycle`, now owned by config).
- `LegacyDependencyError(generator, entry)`: an entry of `dependsOn` is a string, or the generator has an
  `optionalDependsOn` key (both detectable at load since the values are plain JS). Message points to the
  descriptor form and the docs migration note. `TakoGenerator` typing already rejects the old form at
  compile time; this covers untyped/JS drivers.

Top-level uniqueness (`DuplicateGeneratorError`) and `outputs[].generators` / `UnknownGeneratorError`
are unchanged and concern config entries only; private instances never appear there.

### 3. Execution in `@kurotako/core`

`GenerateContext` gains a required field:

```ts
/** Sub-tree under `<namespace>/` the generator must emit into and build module specifiers from. */
segment: string;
```

`run.ts` step 4 becomes a recursive `runGenerator(generator, segment, view, ...)`:

1. Order: `Object.keys(config.generators)` (declaration order). `generatorOrder`, `graph.ts`,
   `graph.test.ts`, `UnknownDependencyError`, `InvalidDependencyError` and `DependencyCycleError` are
   deleted from core; `RunResult.order` stays (now the declaration order) for compatibility.
2. For a top-level generator, `segment = generator.name`. It receives the view
   `filterIR(ir, cfg.namespaces)`.
3. Before calling `generate`, for each `dep` of `generator.dependsOn ?? []`: run
   `runGenerator(dep, `${segment}/${dep.name}`, view)` with the **same** view (so a private instance
   covers exactly its dependent's namespaces) and the same `cycles`. Its `GenOutput` is stored:
   `dependencies[dep.name] = out.artifact`; its files are appended to the dependent's tree.
4. Call `generate({ ir: view, dependencies, cycles, logger, segment })`. Loggers use
   `childLogger(logger, { generator: name })` for top-level and `{ generator: dep.name, dependencyOf:
   parent }` for private ones. A throw is wrapped in `DriverError('generator', name)`; a private
   failure keeps the dependent's name as context so the error reads unambiguously.
5. **Segment guard** (private instances only): every file path must be `<namespace>/<segment>/...`. A
   violation throws `SegmentViolationError(generator, path, expected)` (new core error, code
   `segment_violation`). This catches a third-party generator that hardcodes its name and would otherwise
   land outside its dependent's sub-tree.
6. **Peer merge**: the dependent's artifact `peerDependencies` are unioned with each private artifact's.
   The same package with two different ranges throws the existing `OutputPeerConflictError` (extended to
   accept the dependent/dependency pair) at generation time, not only in mode B; the merged map is what
   `run.ts` stores in `artifacts[name]`. Private artifacts themselves are not added to
   `RunResult.artifacts` (invisible instances).
7. The generator's tree entry is `{ generator: name, files: [...own, ...private] }`, so
   `mergeTrees` collision detection and the `path.split('/')[1]` consumers keep working unchanged:
   `<ns>/angular/zod/User.schema.ts` is attributed to `angular`.

Everything downstream is unchanged and yields the decided behaviour:

- `outputs[].generators: ['angular']` keeps the private tree (segment 1 is `angular`).
- The root barrel re-exports `./angular` only; `angular/index.ts` does not export `zod/`, so a user
  `<ns>/zod/` and the private copy never collide, and no ambiguity warning is emitted. The private code is
  reachable by subpath (`@kurotako/pg/angular/zod/User.schema`).
- Mode B: the files ship in the same per-namespace package (`src/angular/zod/...`, tsup entries are per
  source file); peers come from the merged artifact peers.

### 4. Generators

- `gen-zod` (the only generator used as a dependency): derive the prefix and every module function from
  `ctx.segment`. `names.ts` module helpers take the segment (`entityModule(namespace, segment, entity)`
  or a small `modules(segment)` factory), `generator.ts` uses `` `${namespace}/${ctx.segment}` ``, and
  `buildArtifact(ir, opts, segment)` feeds `entities[*].module` and `extra.perNamespace[*]`. Standalone
  behaviour is identical (`segment === 'zod'`); intra-`gen-zod` relative imports need no change. Public
  `extra` shape is unchanged.
- `gen-angular`: `dependsOn: [{ use: zodGenerator, options: { zodVersion } }]` (function form if the
  Zod options derive from `AngularGeneratorOptions`; exact mapping decided at implementation from
  [options.ts](../../../packages/gen-angular/src/options.ts)). `generate` keeps reading
  `ctx.dependencies.zod`; the `angular/` segment stays hardcoded (nothing depends on `angular`). Its
  `@kurotako/gen-zod` moves from `peerDependencies` to `dependencies`, and `tsconfig.json` references stay.
  The generated angular files import `<ns>/angular/zod/...`.
- Other packages: `gen-typescript`, `gen-openapi` unchanged (no `dependsOn`).
- `gen-react-tanstack` (not yet created): built directly on the descriptor; its interim `zod` option and
  #197 are dropped.
- `packages/config/src/template.ts` and `cli` init: unchanged (`zodGenerator` stays a user-selectable
  generator for users who want Zod output themselves).

## Alternatives considered

- **Core rewrites paths and `module` strings after the fact**: rejected. `extra.perNamespace[*]` and enum
  modules are opaque to core; this is precisely the current Ekoz bug.
- **Shared implicit instance across dependents**: rejected in the overview (option and location
  conflicts); a copy per dependent keeps each generator's output self-contained.
- **Keep the DAG for future name-based edges**: rejected; with no user-visible edges the ordering code
  would be dead and the docs misleading. A future cross-entry dependency can reintroduce ordering then.
- **Descriptor alias key in `ctx.dependencies`**: rejected in the overview (key is the driver name).
- **Emit `zod` as a separate mode B package**: rejected in the overview.

## Consequences (verified against the current code)

- **Breaking for third-party generators** using `dependsOn` by name or `optionalDependsOn`: rejected at
  load with `LegacyDependencyError`. New public surface: `GenerateContext.segment` (required; generators
  that are never dependencies may ignore it), `GeneratorDependency`, config errors above. Removed from
  `@kurotako/core`: `UnknownDependencyError`, `InvalidDependencyError`, `DependencyCycleError`.
- **`gen-angular` output moves**: Zod imports become `<ns>/angular/zod/...`, and the user no longer needs a
  `zod` entry. A user who keeps `zodGenerator` gets two copies (accepted). The existing examples list
  `zodGenerator` next to `angularGenerator` in six configs; each is reviewed: drop the entry where the app
  imports no `@kurotako/<ns>/zod`, keep it where it does.
- **Drift-guard**: `tako check` runs `run({ plan: true })`; private files are in the same tree, so drift
  detection covers them with no CLI change. `RunResult.order` becomes declaration order.
- **Root barrel / ambiguity warning**: unchanged code path; private instance not exported, so no new
  warning. A user `zod` plus `angular` no longer produces the existing `zod`/`angular` name clash for the
  Zod names, because the angular copy is not re-exported.
- **Docs to update**: [docs/architecture.md](../../../docs/architecture.md) (Generator contract, hard vs
  optional, artifact handle), [docs/vision.md](../../../docs/vision.md) (decision "generators form a DAG"
  and the `dependsOn` contract item), [docs/glossary.md](../../../docs/glossary.md) (`dependsOn`),
  [AGENTS.md](../../../AGENTS.md) locked decision, `apps/docs/docs/concepts/dependency-graph.md`
  (rewritten as "Generator dependencies": private instances, no ordering), `parsers-and-generators.md`,
  `getting-started/quick-start.md`, `reference/tako-config.md`, `reference/catalog.md`, the `gen-angular`
  README, plus a migration note. TypeDoc pages under `apps/docs/docs/api/` are regenerated, not edited.
- **Changesets**: `@kurotako/core` minor, `@kurotako/config` minor, `@kurotako/gen-zod` minor,
  `@kurotako/gen-angular` minor (breaking changes in `0.x` are minors).
- **Backlog**: [generator-react-tanstack](../generator-react-tanstack/overview.md) and its technical.md
  drop the interim `zod` option and the "Config and core change" section, and depend on this feature;
  issue #197 is closed as absorbed, #198 loses its dependency on #197 and gains one on this feature's
  config/core task. Issues are edited only when tasks are created.

## Tests

- `core/run.test.ts`: private instance runs before its dependent with segment `<name>/<dep>` and same
  namespaces; `ctx.dependencies.<dep>` present; private files attributed to the dependent
  (`outputs[].generators` filter keeps them); private artifact absent from `RunResult.artifacts`; peers
  merged and a range conflict throws; `SegmentViolationError`; error attribution for a throwing private
  instance; nested dependency segment `a/b/c`; declaration order and `RunResult.order`.
- `core/run.package.test.ts`: mode B keeps private files in the namespace package and merged peers.
- `core/writer/barrel.test.ts`: root barrel excludes the private subtree; no ambiguity warning with a user
  `zod` next to `angular`.
- Delete `core/graph.test.ts`; update `core/errors.test.ts` for the removed and new classes.
- `config/load.test.ts`: static array, function form (receives validated options, throwing/non-array
  result), dependency option validation error naming the dependent, duplicate dependency, cycle,
  legacy string and `optionalDependsOn` errors, deep chain. `define.test.ts`, `define.test-d.ts`: the
  descriptor's `options` is typed from the dependency's schema (required vs optional), the function
  parameter is the dependent's options Output.
- `gen-zod/generator.test.ts`, `artifact.test.ts`: a non-default `segment` changes file paths and every
  artifact module (`entities`, `extra.perNamespace`, enum modules), default output byte-identical.
  `testing/helpers.ts` passes `segment`.
- `gen-angular/generator.test.ts`, `index.test.ts`: `dependsOn` is a zod descriptor; end-to-end run with
  no `zod` entry emits `<ns>/angular/zod/...` and imports resolving to it; with an explicit `zod` entry both
  trees coexist without collision.
- Type check (`tsc -b`) and the runtime compile tests (`*.compile.test.ts`) cover the emitted imports.

## Implementation task breakdown

- [#203 — core, gen-zod: pass ctx.segment to generators and honor it in gen-zod](https://github.com/marmotz/kurotako/issues/203)
- [#204 — core, config, gen-angular: replace name-based dependsOn with private generator dependencies](https://github.com/marmotz/kurotako/issues/204) (depends on #203)
- [#205 — examples: drop the redundant zod generator from the Angular examples](https://github.com/marmotz/kurotako/issues/205) (depends on #204)
- [#206 — docs: document private generator dependencies and the removal of the DAG](https://github.com/marmotz/kurotako/issues/206) (depends on #204)
