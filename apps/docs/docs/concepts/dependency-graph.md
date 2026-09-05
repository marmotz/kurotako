---
title: Dependency graph
sidebar_position: 3
---

# Dependency graph

Generators do not run in the order you list them. Each generator declares what it needs,
and `@kurotako/core` computes a topological order over the resulting directed acyclic
graph (DAG).

## Declaring dependencies

A generator package declares dependencies by generator **name**:

```ts
export const angularGenerator = defineGenerator({
  name: 'angular',
  dependsOn: ['zod'],
  // …
});
```

- **`dependsOn`** — a *hard* dependency. If `angular` is enabled but `zod` is not in the
  `generators` array, `core` rejects the config with an explicit message. The dependency
  also constrains order: `zod` runs first.
- **`optionalDependsOn`** — a *soft* dependency. If the named generator is present, it is
  used and it constrains order; if absent, it is silently ignored.

## Accessing a dependency's artifact

When `generate()` runs, the generator receives a handle to the artifacts of every
generator it depends on. `gen-angular` reads `gen-zod`'s artifact to reuse the emitted
Zod schemas; without it, it would derive its `Validators` from the IR directly.

## Order is computed, not configured

```ts
generators: [
  { use: angularGenerator }, // listed first…
  { use: zodGenerator },     // …but runs second
]
```

`core` sorts the DAG, detects cycles, and runs each generator once. The `generators`
array is a *set* of things to run, not a sequence.

## Why a DAG and no middle stage

There is no fixed "transform" phase between parsing and generating. A generator that
needs another generator's output just depends on it. This keeps the pipeline open: a
future generator (OpenAPI, a client SDK, test-data factories) slots in by declaring its
dependencies, with no change to `core`. The rationale is in
[`docs/architecture.md`](https://github.com/marmotz/kurotako/blob/develop/docs/architecture.md).
