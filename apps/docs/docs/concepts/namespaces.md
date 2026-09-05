---
title: Namespaces
sidebar_position: 4
---

# Namespaces

A **namespace** is the key you give a source in `tako.config.ts`:

```ts
sources: {
  pg: { use: prismaParser, options: { schema: './prisma/pg.prisma' } },
  crm: { use: prismaParser, options: { schema: './prisma/crm.prisma' } },
}
```

Here `pg` and `crm` are namespaces. A namespace must match `^[a-z][a-zA-Z0-9]*$` — it
becomes a directory name and an import-path segment.

## What a namespace does

- **It isolates entities.** `pg.User` and `crm.User` are different entities in the
  [IR](intermediate-representation.md) and are never merged.
- **It drives output location.** Generated code for a namespace lands in its own subtree
  (`generated/kurotako/pg/…`) or, in [mode B](../reference/output-modes.md), its own npm
  package (`@scope/pg`).

## What a namespace does *not* do

- **It never changes generated identifiers.** The entity `User` produces `UserSchema`,
  `UserDto`, `UserForm` whether the config has one namespace or ten. Names are
  deterministic and are never prefixed with the namespace.
- Disambiguation happens through the **import path**, not the identifier:

  ```ts
  import { UserDto } from './generated/kurotako/pg';
  import { UserDto as CrmUserDto } from './generated/kurotako/crm';
  ```

## One parser package, several namespaces

The same parser package can back multiple namespaces — two Prisma schemas, a Prisma
schema and a (future) Mongoose schema, and so on. Each `sources` entry is an independent
instance with its own options.
