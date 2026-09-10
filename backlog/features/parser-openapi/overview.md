# OpenAPI parser (`@kurotako/parser-openapi`)

**Status**: [technical design](technical.md)

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
  before parsing. JSON and YAML are accepted in both cases; v1 remote loading does not
  support authentication or configurable request headers.
- **Versions**: OpenAPI 3.0 and 3.1 in v1. Swagger 2.0 out of scope.
- **Selection**: the whole document is imported in v1 (every `components/schemas` entry
  plus every inline schema reachable from `paths`). Per-tag / per-path filtering is a
  later evolution.
- **IR entities** — schemas + all inline schemas under `paths`:
  - every `components/schemas` entry becomes an IR entity;
  - every inline schema under `paths` (request bodies and responses, all status codes,
    all media types) is synthesised into an entity;
  - inline schemas for `path`, `query`, `header`, and `cookie` parameters are included
    too.
- **Naming of synthesised entities**: `operationId` + role (e.g. `createUser` +
  request → `CreateUserRequest`); fall back to `method` + `path` when `operationId` is
  absent (`POST /users` → `PostUsersRequest`). A response name also includes its status
  code and media type when needed (e.g. `GetUser200ResponseJson`). No warning on the
  fallback.
- **`$ref` between named schemas** → IR `FieldType.ref` (`list: true` for an array). An
  OpenAPI `$ref` is a payload value, not an ORM relation; `Relation` is never emitted.
- **`$ref` resolution**: the parser follows external / remote `$ref` (other files, URLs)
  and retains their reference graph in the IR. (Cache, cycle and auth handling settled
  in `technical.md`.)
- **Composition keywords**: `allOf` is flattened (properties merged into a flat field
  list); `oneOf` / `anyOf` map to the IR **union type** (see dependency below);
  `discriminator` refines the union when present. A schema whose root is `oneOf` / `anyOf`
  maps to an IR **root type alias**.
- **Formats**: all standard OpenAPI formats are recognised. Formats already represented by
  the IR retain their semantics; numeric and binary formats refine the corresponding IR
  value type. An otherwise unmodelled or vendor-specific format remains an accepted
  string rather than making the document invalid.
- **Nullability**: OpenAPI 3.0 `nullable: true` and OpenAPI 3.1 `type: [T, "null"]`
  both normalise to `Field.nullable`.
- **Dictionaries**: `additionalProperties` is supported as a first-class typed map
  (string keys and a typed value), rather than being degraded to untyped JSON.
  `additionalProperties: true` uses an unknown value type. Objects may combine declared
  properties with additional typed keys. This requires an IR evolution that generators
  also support.
- **External references and cycles**: external references are resolved by canonical
  address and loaded once. Reference cycles are valid and retained in the IR; they never
  cause an artificial loading failure.
- **Deduplication**: a repeated resolved reference denotes the same schema, but two
  separately named schemas with an identical structure remain distinct. Structural
  deduplication is out of scope because it could silently merge separate domain concepts.
- **Enums**: OpenAPI enums map to IR enums, including inline enums. Non-string enum
  values are represented as `unknown`; the parser never invents identifiers for them.
- **Unsupported or contradictory schemas**: an unsupported JSON Schema keyword, or
  incompatible duplicate properties in an `allOf`, is a parser error rather than a
  silent approximation.

## Open questions

None at product level.

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md),
  [core-pipeline](../../_archives/features/core-pipeline/overview.md),
  [config-system](../../_archives/features/config-system/overview.md).
- **Hard, blocking**: [ir-union-type](../../_archives/features/ir-union-type/overview.md) — the IR must gain a
  property-level union type and a root type-alias registry before `parser-openapi` can map
  `oneOf` / `anyOf`. That feature is discussed and shipped first.
