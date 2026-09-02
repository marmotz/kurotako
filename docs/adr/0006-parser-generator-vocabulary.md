# 0006 - "parser" / "generator" vocabulary

**Status**: Accepted

**Date**: 2026-09-01

## Context

The two driver roles ([ADR-0002](0002-no-middle-generators-dag.md)) still need names. A generic label like "driver" or
"input driver" / "output driver" is vague and says nothing about what each one actually does.

## Decision

- Input driver = **`parser`**: it reads a schema definition (Prisma file, Mongoose models, OpenAPI spec...) and parses
  it into IR.
- Output driver = **`generator`**: the standard term in codegen.
- Package naming: `@kurotako/parser-<x>`, `@kurotako/gen-<y>`.
- A configured parser instance is called a **source**; its config key is its **namespace**.

## Consequences

### Positive

- The names carry the role. Aligned with the conventions of the codegen ecosystem.

### Negative / costs

- "parser" is a slight abuse for an input that reads a TypeScript AST (Drizzle, Mongoose)
  rather than a DSL file — but the act is still "turn a schema definition into IR".

### Neutral

- Cosmetic rename, no impact on the architecture.

## Rejected alternatives

- **driver / plugin**: too generic.
- **reader / source / input** for the input: "source" is already taken for the configured instance; "input"/"output" add
  nothing over parser/generator.
