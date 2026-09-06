# TypeScript generator (`@kurotako/gen-typescript`)

**Status**: technical design in [technical.md](technical.md)

## Context

Every generator so far emits code tied to a third-party runtime: `gen-zod` produces Zod
schemas, `gen-angular` produces reactive forms. Consumers who only want the shape of the
data - plain type declarations with no validator dependency - have no target. A pure
TypeScript generator fills that gap and can later become a common type layer other
generators depend on.

## Goal

For each IR entity, emit plain TypeScript type declarations (no runtime, no import of a
validation library), aligned on the IR types, optionality/nullability and enums, exported
from the source submodule with a barrel per namespace, following the deterministic naming
rules in [`docs/architecture.md`](../../../docs/architecture.md).

## Decisions made

- Package `@kurotako/gen-typescript`, short name `typescript`. A full-fledged generator,
  not a "middle" stage.
- **Declaration form**: `type` aliases everywhere (no `interface`). Uniform with unions
  and with variant derivation via mapped/utility types; declaration merging is irrelevant
  for regenerated code.
- **Export naming** (deterministic, namespace never prefixes -
  [`docs/architecture.md`](../../../docs/architecture.md)): entity `User` -> `UserDto`,
  aligned on `gen-zod`'s inferred type name. Variants follow the same pattern
  (`UserCreateDto`, `UserUpdateDto`, ...).
- **Variants (v1)**: parity with `gen-zod` - per entity, the full shape plus `Create`,
  `Update`, `Where` and `Select`, derived from the IR with the same rules as `gen-zod`
  (`Create` drops generated/default fields, `Update` is partial, `Where` / `Select` are
  filter/projection shapes).
- **Relations - two families per entity** (parity with `gen-zod`):
  - flat family (`UserDto`): relation fields are the foreign-key id scalars only;
  - deep family (`UserDeepDto`): relations as nested named types; cycles are free in pure
    types.
  - Each variant exists in both families; the consumer picks the family it needs.
- **Enums**: aligned on `gen-zod` - `export const UserRole = [...] as const` plus
  `export type UserRole = (typeof UserRole)[number]`. No TS `enum`.
- **Named scalars - no config in v1**: consume `@kurotako/ir`'s shared `scalarTsType`
  helper verbatim (`decimal -> string`, `bigint -> bigint`, `json -> JsonValue`,
  `date` / `datetime -> Date`, `bytes -> Uint8Array`, `uuid -> string`). `JsonValue` is
  emitted as a recursive helper type in the generator's own sub-tree. An override map is
  a later evolution. (Corrects an earlier draft that said `json -> unknown`.)
- **Constraints** (`min` / `max`, `format`, ...): surfaced as JSDoc only
  (`/** @minLength 3 @format email */`), never in the type. Enforcement stays `gen-zod`'s
  job.
- **Standalone in v1**: no other generator declares `dependsOn: ['typescript']`; `gen-zod`
  keeps its own inferred types. Turning this into a shared type layer is deferred (it
  would require freezing the exposed artifact now).
- **Output per namespace** (aligned on `gen-zod`): one file per entity
  `generated/<ns>/<entity>.type.ts`, a shared `enums.ts`, and an `index.ts` barrel.

## Open questions

- Exact derivation rules per variant - inherited from `gen-zod`'s technical design; this
  generator must not diverge.
- Whether flat + deep multiplied by the variant set is too many exports for v1, or the
  deep family / some variants can be deferred (same question as `gen-zod`).
- Rendering of `Where` on nullable / list fields in pure types.
- JSDoc constraint vocabulary - reuse `gen-zod`'s constraint names verbatim.
- File layout when an entity has many variants (one file per entity vs per variant).

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md),
  [core-pipeline](../../_archives/features/core-pipeline/overview.md).
- Mirrors [generator-zod](../../_archives/features/generator-zod/overview.md) on naming,
  variants, relation families, enums and scalar mapping - keep the two aligned; `gen-zod`
  is the reference when a rule is ambiguous.
