# Angular generator (`@kurotako/gen-angular`)

**Status**: technical design in [technical.md](technical.md)

## Context

The project's differentiator: Angular as an output target, a blind spot of the current
ecosystem. Produces the entity types and typed Angular forms whose validation is aligned
on the schema constraints, reusing the Zod DTOs and schemas emitted by `gen-zod`.

## Goal

For each entity, generate strongly typed Angular forms (`Create` and `Update` shapes) on
two surfaces — a `providedIn: 'root'` reactive factory service and Signal Forms
`schema` + model functions — whose validation delegates entirely to the Zod schema.

## Decisions made

- Package `@kurotako/gen-angular`, short name `angular`.
- **Hard dependency on `zod`**: `dependsOn: ['zod']` is mandatory. There is no
  Validators-from-IR fallback in v1; the generator consumes the artifact exposed by
  `gen-zod` ([docs/architecture.md](../../../../docs/architecture.md)).
- **Angular target**: typed reactive forms, minimum Angular 17. The typed forms API is
  mandatory (no pre-typed-forms compat mode). Emitting the Signal Forms surface raises the
  effective minimum to the Angular release that ships `@angular/forms/signals` as a stable
  API (Angular 22 at time of writing — pin the exact floor at implementation).
- **Signal Forms**: in scope for v1 alongside typed reactive forms. Each entity gets both
  a reactive typed `FormGroup` and a Signal Forms variant. The generator carries the cost
  of supporting and testing both surfaces.
- **Output shape**: the reactive surface is one `@Injectable({ providedIn: 'root' })`
  factory service per entity (e.g. `UserFormFactory`). The Signal Forms surface is pure
  exported `schema` + model-factory functions (no DI wrapper — `form()` lives in the
  consumer component). Both surfaces are selectable via a `forms` option; default emits
  both.
- **Form variants**: per entity, a `Create` form (built on the Zod `Create` variant, no
  generated fields) and an `Update` form (built on the Zod `Update` variant, partial with
  id). No full-model form in v1.
- **Validation**: delegated entirely to Zod. The reactive form runs one group-level
  `ValidatorFn` that `safeParse`s against the corresponding Zod schema and distributes
  each issue onto the matching control by path (group-level fallback for cross-field
  issues). The Signal Forms schema contains a single root tree validator delegating to
  Zod. No native Angular `Validators` and no Signal Forms built-in rules
  (`required()`, `minLength()`, ...) are generated. Cross-field rules and named formats
  are therefore covered by the Zod schema.
- **Relations**: **flat by default** — relation foreign keys are ordinary scalar controls,
  relation objects produce no control. An opt-in `relations: 'deep'` option emits a nested
  `FormGroup` for `one` and a `FormArray` for `many`, driven by the Zod deep family.
  Cross-source relations always stay flat.
- **Enums**: reuse the `const` string array emitted by `gen-zod`; the control type is the
  string union. Validation of the enum value is part of the Zod schema.
- Deterministic identifiers, output per namespace
  ([docs/architecture.md](../../../../docs/architecture.md)).

## Open questions

- `@angular/forms/signals` is stable as of Angular 22. A few secondary APIs may still
  shift on a minor; the generated `signal` output may then need a regen. Contained: every
  Signal Forms call site lives in one runtime helper file, so a follow-up is a single-file
  change. The maintainer tracks Angular releases and adjusts a posteriori if needed.
- Debounced server-side uniqueness / async checks: out of v1, revisit once `gen-zod`
  emits async refinements.
- Whether a future consumer of the Angular artifact (Storybook, app scaffold) needs more
  than the `entities` symbols + `extra` currently exposed.

## Depends on

- [ir-model](../ir-model/overview.md), [core-pipeline](../core-pipeline/overview.md).
- [generator-zod](../generator-zod/overview.md) — **hard dependency** (`dependsOn: ['zod']`).

## Feature order

Comes after [generator-zod](../generator-zod/overview.md) in the work order, which must
first expose a stable consumable artifact.
