---
title: Intermediate representation
sidebar_position: 2
---

# Intermediate representation (IR)

The **IR** is the common data model every parser writes and every generator reads. It is
source- and target-agnostic: it describes *what* the schema says, not how any particular
tool spells it.

## Shape

The IR is a set of **sources**, keyed by [namespace](namespaces.md). Each source records
which parser produced it and holds its entities and enums:

```text
IR
└─ sources
   └─ db                     # one entry per namespace
      ├─ parser: "prisma"
      ├─ entities
      │  └─ User
      │     ├─ fields[]      # name, type, list, optional, nullable, constraints, default, doc
      │     ├─ relations[]   # target (namespace + entity), cardinality, owning, fk fields…
      │     ├─ enums         # entity-scoped enums
      │     ├─ primaryKey
      │     ├─ indexes[] / uniques[]
      │     ├─ additionalProperties  # field type for unlisted keys — optional
      │     └─ doc
      ├─ enums               # source-scoped enums
      └─ typeAliases         # named field types (unions, refs) — optional
```

A **field type** is one of `scalar` (`string`, `int`, `bigint`, `float`, `decimal`,
`boolean`, `datetime`, `date`, `json`, `bytes`, …), `enum` (a reference to an enum
definition), `unknown` (with an optional hint, when a parser cannot map the source type),
`ref` (a same-source reference to an entity or a named type alias), `union` (a list of
variants, optionally discriminated), `map` (`{ kind: 'map', value: FieldType }`, a
string-keyed dictionary), or `array` (`{ kind: 'array', element: FieldType }`, for an
array type that isn't a plain `list` field — a nested array, an array-typed alias, or an
array inside a union). A source may also carry `typeAliases` — named field types,
typically unions, reused across fields. An entity may carry `additionalProperties` — the
field type for keys not otherwise declared, i.e. an open/catch-all shape. `ref` cycles are
allowed; the validator flags them informationally rather than rejecting them.

The IR format itself is versioned (`IR_VERSION`, currently `'4'`); `isCompatible` checks a
`SourceIR`'s `irVersion` against it before merging.

**Constraints** carried on a field: `min` / `max`, `minLength` / `maxLength`, `regex`,
`format` (`email`, `uuid`, `url`, …), `unique`. Generators translate these into their own
validation vocabulary — Zod refinements, Angular `Validators`, and so on.

## Keyed by `(namespace, entity)`

`db.User` and `analytics.User` are two distinct entities. They are **never merged**.
`core` rejects a config where two sources declare the same namespace, so within a
namespace an entity name is unique.

## Deterministic and validated

- The `@kurotako/ir` package owns the Valibot schemas; they are the source of truth and
  the inferred TypeScript types come from them.
- `core` validates the merged IR (`assertIR`) before any generator runs.
- Generated identifiers are deterministic and never namespace-prefixed: the entity `User`
  always yields `UserSchema`, `UserDto`, `UserForm` — see [Namespaces](namespaces.md).

The full field-by-field draft is in
[`docs/ir.md`](https://github.com/marmotz/kurotako/blob/develop/docs/ir.md); the runtime
schemas are documented in the [`@kurotako/ir` API reference](../api/).
