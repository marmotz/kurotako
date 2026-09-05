---
slug: /
title: Introduction
sidebar_position: 1
---

# kurotako

**kurotako** is a modular framework for keeping TypeScript schemas in sync — from the
data model, through a validation layer, down to frontend types and forms. Its CLI is
`tako`; every package is published under the `@kurotako/*` scope.

## The problem

In a stack like NestJS + Prisma + Angular, the data schema is defined once (in Prisma),
but the API validation DTOs and the frontend types and forms are either duplicated by
hand or produced by tools locked onto a single technology combination — typically
Prisma → Zod → React. Nothing exists as a generic, interchangeable pipeline.

## The approach

kurotako models code generation as a pipeline of two kinds of component:

- **Parsers** read a schema source (a `schema.prisma` file, for example) and produce a
  slice of an [intermediate representation](concepts/intermediate-representation.md) (IR)
  under a [namespace](concepts/namespaces.md).
- **Generators** consume the merged IR — plus the artifacts of the generators they
  depend on — and emit code (Zod schemas, Angular types and `FormGroup`s, …).

There is no fixed middle stage. Generators declare their dependencies and
[core computes a topological order](concepts/dependency-graph.md); parsers and
generators are wired by a dependency DAG.

```text
schema.prisma ──▶ parser-prisma ──▶  IR  ──▶ gen-zod ──────▶ Zod schemas
                                      │          │
                                      │          ▼
                                      └──────▶ gen-angular ─▶ types + typed FormGroups
```

## MVP scope

1. `@kurotako/parser-prisma` — `schema.prisma` → IR.
2. `@kurotako/gen-zod` — IR → Zod schemas.
3. `@kurotako/gen-angular` — IR (+ Zod) → types, typed `FormGroup`s and `Validators`
   aligned on the schema constraints.
4. `@kurotako/cli` — the `tako` binary orchestrating the pipeline against a real project.

Supporting packages: `@kurotako/ir` (shared types and schemas), `@kurotako/core`
(orchestration, DAG resolution, IR merge) and `@kurotako/config` (the `tako.config.ts`
loader).

## Next steps

- [Quick start](getting-started/quick-start.md) — install `tako` and run a first
  generation.
- [Installation](getting-started/installation.md) — requirements and how to add parser
  and generator packages.
- [Configuration reference](reference/tako-config.md) — the full `tako.config.ts` shape.

The design documents (`docs/vision.md`, `docs/architecture.md`, `docs/glossary.md`) live
in the [repository](https://github.com/marmotz/kurotako/tree/develop/docs) and record the
rationale behind these decisions.
