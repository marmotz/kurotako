# IR model (`@kurotako/ir`)

**Status**: technical design — [technical.md](technical.md)

## Context

The IR is the central contract between parsers and generators. It must be rich enough to
carry types, constraints, cardinalities and relations, and stay agnostic of the source
and the target so as not to rule out future generators (OpenAPI, SDK, factories).

## Goal

A `@kurotako/ir` package exposing the Valibot schemas of the IR, the TypeScript types
inferred from them, traversal helpers, and a builder API for parsers. A documented and
versioned format with its own shape, not modelled on any generator's schema library.

## Decisions made

- **Own format.** The IR *shape* has its own design, not modelled on any generator's
  schema library, and nothing Prisma/Zod/Angular specific in it
  ([docs/architecture.md](../../../../docs/architecture.md)). The serialized IR stays
  plain JSON (no classes / `Date` / `RegExp`), so a third party can consume an
  `--emit-ir` dump without any kurotako dependency.
- **Validation library: Valibot (schema-first).** The IR types are *inferred* from a set
  of Valibot schemas that are the single source of truth; `validateIR` / `assertIR` /
  `parseIR` run those schemas plus a few cross-reference checks. Rationale: reuse a
  proven, tree-shakeable validator instead of re-developing structural validation by
  hand, and share one validation library with [config-system](../config-system/overview.md)
  and `@kurotako/core`. `@kurotako/ir` gains a single runtime dependency (`valibot`).
- **Structure** = `{ irVersion, sources: Record<namespace, SourceIR> }`
  ([docs/ir.md](../../../../docs/ir.md)). Entity key `(namespace, name)`, no merging of
  homonyms ([docs/architecture.md](../../../../docs/architecture.md)).
- **Closed `ScalarType` list.** A small fixed set (`string`, `boolean`, `int`, `bigint`,
  `float`, `decimal`, `date`, `datetime`, `uuid`, `bytes`, `json`), plus an `unknown`
  escape hatch with a `hint`. Semantic string types (`email`, `url`, `cuid`, ISO
  `datetime`, ...) are **not** scalars: they are `string` + a constraint.
- **Non-trivial types** (`decimal`, `bigint`, `json`, `bytes`) are named scalars only.
  The IR does not prescribe their runtime representation; each generator chooses
  (string vs native `bigint`, `unknown` vs sub-schema, `Uint8Array`, ...).
- **Rich constraints carried by the IR.** `Constraints` carries structural bounds
  (`min`/`max`, `minLength`/`maxLength`, `unique`, `default`) plus a named **`format`**
  vocabulary (`email`, `url`, `uuid`, `cuid`, `datetime`, ... — closed, extensible list)
  and a free `regex` fallback. Generators map `format` to their idiom (`z.email()`,
  `Validators.email`) and fall back to `regex` otherwise.
- **Enums: both scopes, with resolution.** Source-level enums (`SourceIR.enums`, the
  default, matches Prisma) and entity-local enums. A field's `enum` ref resolves
  entity-local first, then source-level.
- **Relations modelled in depth for v1.** Logical relation + qualified `target`
  (`namespace.entity`, cross-source possible at format level, ignored by v1 drivers —
  [docs/architecture.md](../../../../docs/architecture.md)) + `cardinality`
  (`one`/`many`) + `optional` + owning side + back-relation + explicit foreign-key
  field(s) + referential actions (`onDelete`/`onUpdate`).
- **Metadata carried from v1.** Doc comments, `@map`/`@@map`, indexes, composite unique
  constraints — all in the IR even where no v1 generator consumes them yet.
- **`irVersion`** — a single IR schema version string. The core rejects a parser or
  generator declaring an incompatible version. `@kurotako/ir` is versioned independently
  (changesets).
- **Serialization: in memory by default.** The pipeline passes the IR as an object. A
  `--emit-ir` flag dumps `generated/ir/*.json` for debugging and third-party generators;
  normal operation has no file dependency.
- **`@kurotako/ir` v1 delivers**: the Valibot schemas and the types inferred from them, a
  runtime validation entry (schema parse + enum-ref resolution + relation-target
  coherence, run by the core after each parser), traversal/lookup helpers
  (`resolveEntity`, `iterFields`,
  `resolveRelationTarget`, `resolveEnum`, ...), and a builder/assertions API for parsers
  to assemble a partial `SourceIR` with incremental validation.
- **The helper library is the home of every cross-driver decision.** Any modelling rule a
  parser or generator would otherwise re-implement in its own way — the `create` / `update`
  payload shape, the scalar → TS type mapping, "is this value db-assigned" — is exposed as
  a pure helper from `@kurotako/ir` so the whole pipeline reads it from one place. Parsers
  and generators consume these helpers; they do not copy the rule. See
  [technical.md §Shared-decision helpers](technical.md#shared-decision-helpers-helpersts).

## Open questions

- Exact `format` vocabulary and how far parsers are expected to populate it.
- Shape of the builder API (fluent vs plain functions) — defer to `technical.md`.
- Exactly which cross-reference checks stay outside Valibot (post-parse pass) vs are
  expressed as `v.rawCheck` pipe actions — defer to `technical.md`.

## Depends on

- [monorepo-bootstrap](../monorepo-bootstrap/overview.md).

Consumed by: `core-pipeline`, every `parser-*`, every `gen-*`.
