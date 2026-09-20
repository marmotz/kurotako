---
title: Generator dependencies
sidebar_position: 3
---

# Generator dependencies

Generators run in the order you list them in `generators`. There is no dependency graph
between config entries and no ordering to compute. When a generator needs another
generator's output, it declares that generator as a **private dependency**: `core` runs
a copy of it for that generator alone.

## What a private dependency is

`gen-angular` reuses the Zod schemas that `gen-zod` emits (`gen-react-tanstack` does the same
and declares its dependency identically, under `<namespace>/react-tanstack/zod/`). Instead of
asking you to add a `zod` entry and keep the two in sync, it declares the dependency itself:

```ts
export const angularGenerator = defineGenerator({
  name: 'angular',
  optionsSchema: AngularGeneratorOptions,
  dependsOn: (options) => [
    { use: zodGenerator, options: { zodVersion: options.zodVersion } },
  ],
  // …
});
```

When the `angular` entry runs, `core`:

1. runs a **private instance** of `zodGenerator` first, on exactly the namespaces the
   `angular` entry covers, with the options from the descriptor;
2. hands the instance's artifact to `angular` as `ctx.dependencies.zod`;
3. writes the instance's files under the dependent's own sub-tree,
   `<namespace>/angular/zod/`;
4. merges the instance's `peerDependencies` (here `zod`) into `angular`'s, so a mode B
   package declares them once.

You do not add `zodGenerator` to `generators` for this to work.

## Declaring a dependency

`dependsOn` is a list of descriptors, `{ use, options? }` (a `generators` entry without
`namespaces`). `options` is type-checked against the dependency's own `optionsSchema`,
exactly like a config entry.

```ts
dependsOn: [{ use: zodGenerator, options: { zodVersion: 4 } }],
```

The **function form** receives the generator's own validated options, so a dependency's
options can derive from them:

```ts
dependsOn: (options) => [
  { use: zodGenerator, options: { zodVersion: options.zodVersion } },
],
```

Rules:

- A driver can appear once per `dependsOn` (`DuplicateDependencyError`): its name is the
  key in `ctx.dependencies` and part of its output path.
- Dependencies can nest (a dependency can have its own); each level adds a path segment.
  A cycle, only reachable through the function form, is rejected when the config loads
  (`DependencyCycleError`).
- A function that throws, or returns something that is not an array of descriptors, fails
  the config load with an error naming the generator.

## Where the files go: the segment

A top-level generator emits into `<namespace>/<name>/`. A private instance emits into the
nested path `<namespace>/<parent>/<name>/`, for example `<namespace>/angular/zod/`. Core
passes that sub-tree to every generator as `ctx.segment`.

A generator that is meant to be used as a dependency must build its file prefix and every
module specifier it publishes in its artifact from `ctx.segment`, never from a hardcoded
name. `gen-zod` does this. Core checks it: a private instance that emits a file outside
`<namespace>/<segment>/` fails with `SegmentViolationError`.

## What you see as a user

- **Output filters.** The private files belong to the dependent:
  `outputs[].generators: ['angular']` keeps `<namespace>/angular/zod/`.
- **Root barrel.** `<namespace>/index.ts` re-exports `angular` but not its private `zod`
  copy, so a private copy never clashes with your own `zod` entry, and no ambiguous-export
  warning appears. The code stays importable by subpath, for example
  `@kurotako/pg/angular/zod/User.schema`.
- **Your own `zod` entry.** Keep it if your code imports `<namespace>/zod` itself. You
  then get two copies (`<namespace>/zod/` and `<namespace>/angular/zod/`); that is
  expected.
- **Mode B.** The private files ship in the same per-namespace package
  (`src/angular/zod/...`) and its `peerDependencies` are merged.
- **Errors.** A private instance that throws is reported with its own name and the
  generator it belongs to.

## Migrating from name-based `dependsOn`

Earlier versions declared dependencies by name and computed a run order:

```ts
// Before
defineGenerator({ name: 'angular', dependsOn: ['zod'], optionalDependsOn: ['x'] /* … */ });
```

That form is removed, along with the topological ordering and its errors
(`UnknownDependencyError`, `InvalidDependencyError`). A string in `dependsOn`, or an
`optionalDependsOn` key, now fails at load with `LegacyDependencyError`. Replace it with
descriptors:

```ts
// After
defineGenerator({
  name: 'angular',
  dependsOn: [{ use: zodGenerator, options: { zodVersion: 4 } }],
  // …
});
```

For users of `gen-angular`:

- You no longer need a `zod` entry for `gen-angular`. Remove it unless your code imports
  `<namespace>/zod`.
- The Zod imports in the generated Angular files become `<namespace>/angular/zod/...`
  (they were `<namespace>/zod/...`).
- `zodVersion` moves to the `angular` entry (`options: { zodVersion: 3 }`; default `4`).
- `@kurotako/gen-zod` is now a regular dependency of `@kurotako/gen-angular`; you do not
  need to install it separately unless you use `zodGenerator` yourself.

For authors of third-party generators: build paths and module specifiers from
`ctx.segment` if your generator can be used as a dependency, and declare what you need as
descriptors. The design rationale is in
[`docs/architecture.md`](https://github.com/marmotz/kurotako/blob/develop/docs/architecture.md).
