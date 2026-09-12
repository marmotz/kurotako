# OpenAPI generator

**Status**: [technical design](technical.md)

## Context

kurotako already has a symmetric feature in the other direction: `parser-openapi` reads
an OpenAPI document into the IR. A generator producing an OpenAPI document *from* the
IR lets a schema whose source of truth is `parser-prisma` (or any other parser) also
publish a data-contract document, without duplicating the data shapes by hand.

The generator contract and the IR are defined in
[`docs/architecture.md`](../../../docs/architecture.md) and
[`docs/ir.md`](../../../docs/ir.md).

## Goal

Turn the (namespace-filtered) IR into an OpenAPI document exposing every entity as a
`components/schemas` entry, following the standard `Generator` contract
(`docs/architecture.md` "Generators and DAG").

## Decisions made

- **Scope**: data schemas only (`components/schemas`). The generator does not emit
  `paths` / operations — the IR has no concept of an HTTP endpoint (verb, route,
  request/response association, status codes), only data shapes. Adding that would be a
  separate, much larger IR evolution (comparable in scope to `ir-union-type`) and is
  explicitly out of scope for this feature.
- **Target versions**: both OpenAPI 3.0 and 3.1, mirroring `parser-openapi`'s supported
  versions.
- **Package**: `@kurotako/gen-openapi`, short name `openapi`, following the existing
  generator naming convention (`gen-zod` → `zod`, `gen-angular` → `angular`).
- **Output format**: both JSON and YAML supported, selected through a generator option
  with a default (default value to settle in `technical.md`).
- **Union mapping**: symmetric to `parser-openapi` — an IR union maps to `oneOf`; when
  the IR carries a discriminator, it is emitted as an OpenAPI `discriminator`. Keeps a
  spec → IR → spec round-trip consistent with the existing parser.

## Open questions

- Dependency on other generators (if any), and the default output format when the
  option is unset — to settle in `technical.md`.

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md),
  [core-pipeline](../../_archives/features/core-pipeline/overview.md).
- Related (inverse direction, no hard dependency): [parser-openapi](../parser-openapi/overview.md).
