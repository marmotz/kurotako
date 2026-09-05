---
title: Parsers and generators
sidebar_position: 1
---

# Parsers and generators

kurotako has exactly two kinds of component. There is no third "transformer" or "middle"
stage.

## Parsers

A **parser** turns a schema source into a slice of the
[intermediate representation](intermediate-representation.md). It is responsible for one
input technology:

- `@kurotako/parser-prisma` reads a `schema.prisma` file (or Prisma's multi-file schema
  folder) and produces IR entities, fields, enums and relations.

A parser entry lives under `sources` in `tako.config.ts`. The **config key is the
[namespace](namespaces.md)** the parser's output is filed under:

```ts
sources: {
  db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
}
```

The same parser package can be instantiated several times under different keys — for
example a Prisma schema for PostgreSQL under `pg` and another under `analytics`.

A parser may also implement `watchPaths()`, which lets `tako generate --watch` know which
files to watch without understanding the parser's options.

## Generators

A **generator** consumes the merged IR — and, optionally, the artifacts produced by other
generators — and emits files:

- `@kurotako/gen-zod` emits Zod schemas from the IR.
- `@kurotako/gen-angular` emits TypeScript types, typed `FormGroup`s and `Validators`
  aligned on the schema constraints. It declares `dependsOn: ['zod']` and reads the Zod
  generator's artifact.

Generator entries live in the `generators` array. Order in the array is irrelevant —
`core` computes the run order from the declared
[dependencies](dependency-graph.md):

```ts
generators: [
  { use: zodGenerator },
  { use: angularGenerator }, // dependsOn: ['zod'] — runs after zod regardless of array order
]
```

A generator entry can restrict its IR view to a subset of namespaces with
`namespaces: ['db']`; by default a generator sees every namespace.

## The pipeline

```text
sources ──parse──▶ SourceIR per namespace ──merge──▶ IR
                                                      │
                             topological order  ┌─────┴─────┐
                                                ▼           ▼
                                             gen-zod ──▶ gen-angular
                                                │           │
                                                ▼           ▼
                                              files       files ──▶ writer ──▶ disk
```

Each step fails fast: the first error stops the run. `tako validate` runs the whole
pipeline except the final write.

## Vocabulary

kurotako has exactly two component words — **parser** and **generator** — and uses them
consistently. Packages declare a parser with `defineParser` and a generator with
`defineGenerator`, both from `@kurotako/config`. The rationale for the pipeline shape is in
[`docs/architecture.md`](https://github.com/marmotz/kurotako/blob/develop/docs/architecture.md).
