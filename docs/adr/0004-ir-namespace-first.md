# 0004 - Namespace-first IR, deterministic generated identifiers

**Status**: Accepted

**Date**: 2026-09-01

## Context

With several sources ([ADR-0003](0003-multiple-parsers-namespaces.md)), two `User`
entities (one per source) can coexist. First idea: prefix the generated identifiers based on the number of sources
(`UserSchema` if only one, `PgUserSchema` / `MongoUserSchema` if several). Rejected: the generated code changes shape
depending on the config, and adding a source breaks every existing import.

## Decision

- **The IR is keyed `(namespace, entity)`.** `pg.User` and `mongo.User` are two distinct entities, never merged, with
  independent constraints.
- **The generated identifiers are deterministic**: the entity `User` always produces
  `UserDto`, `UserSchema`, `UserForm`, regardless of the number of sources. No prefix, no mangling.
- **The namespace only drives the output location**: one directory / submodule per source, named after the config key.
- **Disambiguation through the import path**; the user adds an alias if they need two homonyms in the same file:

  ```ts
  import { UserDto } from '@kurotako/pg'
  import { UserDto as MongoUserDto } from '@kurotako/mongo'
  ```

- Name collision is no longer a problem (distinct modules). The core only rejects two sources with the same key.

## Consequences

### Positive

- The generated code does not depend on the number of sources: adding `mongo` does not touch the `pg` output.
- Readable output (no prefixes), idiomatic imports.
- Consistent with how Prisma Client, gRPC, etc. isolate by module and not by identifier prefix.

### Negative / costs

- The user importing two homonyms must manage the aliases themselves.
- Each generator must write into a per-namespace tree and generate a barrel (`index.ts`)
  per source.
- Cross-source relations will have to reference a module, not just a symbol.

### Neutral

- The module name (`@kurotako/pg`) is the same in mode A and mode B ([ADR-0005](0005-output-modes.md)).

## Rejected alternatives

- **Conditional identifier prefix**: unstable output, adding a source is a breaking change.
- **Systematic identifier prefix** (`PgUserDto` even with a single source): verbose, forces the notion of a source onto
  the single-source user.
