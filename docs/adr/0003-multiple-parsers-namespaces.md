# 0003 - Several parsers active, isolated by namespace

**Status**: Accepted

**Date**: 2026-09-01

## Context

A real project can have several databases or database systems: Prisma for PostgreSQL **and** Mongoose for MongoDB, plus
tomorrow inputs of another kind (OpenAPI, JSON Schema). A single active parser does not cover this case. Constraint:
entities from different sources must not step on each other (a `User` entity can exist in two sources with different
fields and constraints).

## Decision

Several `parsers` active simultaneously. The configuration declares **sources**, whose **key is the namespace**:

```yaml
sources:
  pg: { parser: 'prisma',   schema: './prisma/schema.prisma' }
  mongo: { parser: 'mongoose', models: './src/models/*.ts' }
```

- The `parser` field designates the package; the key (`pg`, `mongo`) is the namespace.
- The same parser package can be instantiated several times under different namespaces (two `schema.prisma` files).
- Each parser produces a **partial IR**; the core merges them into a global IR keyed by namespace.
- The core rejects two sources declaring the same namespace. There is no entity collision:
  the namespace isolates them.

## Consequences

### Positive

- Multi-database stacks supported natively.
- Opens the door to heterogeneous input types without an architecture change.

### Negative / costs

- The whole chain (IR, generators, output) must reason per namespace, not flat.
- Cross-source relations become conceivable: the IR must carry a qualified target identifier (`namespace.entity`), even
  though the v1 drivers do not handle them.

### Neutral

- A single namespace = the degenerate case, must stay ergonomic (see
  [ADR-0004](0004-ir-namespace-first.md)).

## Rejected alternatives

- **A single active parser**: does not cover multi-database, blocks heterogeneous inputs.
- **Merging homonym entities across sources**: loss of information, ambiguity on the constraints, impossible to
  reconcile automatically.
