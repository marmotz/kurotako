# OpenAPI parser (`@kurotako/parser-openapi`)

**Status**: in discussion

## Context

kurotako's first parser (`parser-prisma`) reads a database model. A second parser source
is needed for teams whose schema of record is an HTTP API contract: an OpenAPI document
describing endpoints and their request/response shapes. Reading that contract lets the
existing generators (`gen-zod`, and the planned `gen-typescript`) emit validators / types
for the API surface without re-declaring them by hand.

The parser contract and the target IR are defined in
[`docs/architecture.md`](../../../docs/architecture.md) and
[`docs/ir.md`](../../../docs/ir.md).

## Goal

Turn a configured OpenAPI document into a partial `SourceIR` under its namespace,
conforming to [`@kurotako/ir`](../../_archives/features/ir-model/overview.md), covering the
"object subset" of JSON Schema plus its composition keywords via the IR union type.

## Decisions made

- Package `@kurotako/parser-openapi`, short name `openapi`. Instantiable multiple times
  (several documents), one instance = one document = one namespace
  ([`docs/architecture.md`](../../../docs/architecture.md)).
- **Input**: a file path *or* an HTTP(S) URL, resolved to the same in-memory document
  before parsing.
- **Versions**: OpenAPI 3.0 and 3.1 in v1. Swagger 2.0 out of scope.
- **Selection**: the whole document is imported in v1 (every `components/schemas` entry
  plus every inline schema reachable from `paths`). Per-tag / per-path filtering is a
  later evolution.
- **IR entities** — schemas + all inline schemas under `paths`:
  - every `components/schemas` entry becomes an IR entity;
  - every inline schema under `paths` (request bodies and responses, all status codes,
    all media types) is synthesised into an entity.
- **Naming of synthesised entities**: `operationId` + role (e.g. `createUser` +
  request → `CreateUserRequest`); fall back to `method` + `path` when `operationId` is
  absent (`POST /users` → `PostUsersRequest`). No warning on the fallback.
- **`$ref` between named schemas** → IR `Relation` (`cardinality: one`, or `many` inside
  an array), aligning `parser-openapi` with `parser-prisma` for downstream generators.
- **`$ref` resolution**: the parser follows external / remote `$ref` (other files, URLs)
  and inlines them itself. (Cache, cycle and auth handling settled in `technical.md`.)
- **Composition keywords**: `allOf` is flattened (properties merged into a flat field
  list); `oneOf` / `anyOf` map to the IR **union type** (see dependency below);
  `discriminator` refines the union when present. A schema whose root is `oneOf` / `anyOf`
  maps to an IR **root type alias**.

## Open questions

- Named-scalar mapping for OpenAPI `format` values (`date-time`, `uuid`, `email`,
  `int64`, `byte`, `binary`, ...) onto the IR `ScalarType` / `StringFormat` vocabulary.
- OpenAPI 3.0 `nullable: true` vs 3.1 `type: [T, "null"]` — normalisation to
  `Field.nullable`.
- `additionalProperties` (open records / dictionaries) with no clean IR field mapping.
- Cycle handling while inlining external `$ref`.
- Deduplication when an inline schema is structurally identical to a named one.

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md),
  [core-pipeline](../../_archives/features/core-pipeline/overview.md),
  [config-system](../../_archives/features/config-system/overview.md).
- **Hard, blocking**: [ir-union-type](../ir-union-type/overview.md) — the IR must gain a
  property-level union type and a root type-alias registry before `parser-openapi` can map
  `oneOf` / `anyOf`. That feature is discussed and shipped first.
