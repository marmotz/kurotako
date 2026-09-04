# Zod generator (`@kurotako/gen-zod`)

**Status**: technical design in [technical.md](technical.md)

## Context

The first validation generator. Takes the IR and produces Zod schemas (DTOs). Also serves
as a dependency for `gen-angular` (reusing the Zod DTOs on the form side).

## Goal

For each entity, a set of Zod schemas aligned on the IR types and constraints, exported
from the source submodule, with a barrel per namespace.

## Decisions made

- Package `@kurotako/gen-zod`, short name `zod`.
- A full-fledged generator, not a "middle" stage
  ([docs/architecture.md](../../../docs/architecture.md)).
- **Zod target**: emit the Zod v4 API by default, with an opt-in compatibility mode that
  falls back to the v3 API. Generator carries the cost of supporting both.
- **Export naming** (deterministic, namespace never prefixes —
  [docs/architecture.md](../../../docs/architecture.md)):
  entity `User` → schema `UserSchema`, inferred type `UserDto`. Variant schemas follow
  the same pattern (`UserCreateSchema`, `UserCreateDto`, ...).
- **Schema variants (v1)**: per entity, emit the full model plus `Create`, `Update`,
  `Where` and `Select` variants, derived from the IR (e.g. `Create` drops
  generated/default fields, `Update` is partial, `Where` / `Select` are filter/projection
  shapes).
- **Relations — two schema families per entity**:
  - flat family: relation fields are the foreign-key id scalars only;
  - deep family (`UserDeepSchema`, ...): relations as `z.lazy(() => ...)` nested schemas,
    handling cycles.
  - Each variant (full / Create / Update / Where / Select) exists in both families; the
    consumer picks the family it needs.
- **Named scalars — pragmatic defaults, no config in v1**:
  `decimal → z.string()`, `bigint → z.bigint()`, `json → z.unknown()`,
  `date` / `datetime → z.coerce.date()`, `bytes → z.string()`, `uuid → z.uuid()` (v4) /
  `z.string().uuid()` (v3 compat). Documented; an override map is a later evolution.
- **Constraints** map to Zod refinements: `min` / `max`, `minLength` / `maxLength`,
  `regex`, and the named `format` vocabulary (`email`, `url`, ...) to their Zod equivalent.
- **Enums**: generate a `const` string array (`export const UserRole = [...] as const`)
  consumed by `z.enum(UserRole)`. No TS `enum`, no `z.nativeEnum`. Inferred type is the
  string union. Works in both v4 and v3 compat mode.
- **Output per namespace**: one file per entity `generated/<ns>/<entity>.schema.ts`, a
  shared `enums.ts`, a shared `filters.ts` (Where operator schemas), and an `index.ts`
  barrel.
- **Zod version**: generator option `zodVersion: 3 | 4` (default `4`); one emit targets one
  API flavor.
- **`Where` variant**: Prisma-style operator objects (`equals` / `in` / `lt` / `contains`
  ...) plus `AND` / `OR` / `NOT`.
- Must expose an artifact consumable by `gen-angular` (see open questions).

## Open questions

- Exact derivation rules for each variant (which fields `Create` drops, how `Where`
  models scalar filters and relation filters, what `Select` looks like).
- Whether flat + deep families multiplied by 5 variants is too many exports for v1, or
  whether the deep family / some variants can be deferred.
- Precise artifact shape exposed to `gen-angular` — **deferred to `technical.md`**, once
  the dependency-handle mechanics are settled
  ([vision.md open question §3](../../../docs/vision.md#open-questions)).
- Rendering details for `Where` on nullable / list fields.
- File layout when an entity has many variants (one file per entity vs one per variant).

## Depends on

- [ir-model](../ir-model/overview.md), [core-pipeline](../core-pipeline/overview.md).
- **Hard** upstream dependency of [generator-angular](../generator-angular/overview.md):
  `gen-angular` sets `dependsOn: ['zod']` and consumes the artifact exposed here, so the
  consumable artifact shape must be settled before `gen-angular`'s technical design.
