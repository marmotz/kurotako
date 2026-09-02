# backend — @kurotako/gen-angular deep relation mode (nested FormGroup / FormArray)

**Status**: to do **Type**: backend **Issue**: [#42](https://github.com/marmotz/kurotako/issues/42)

Reference: [../features/generator-angular/technical.md §Relations](../features/generator-angular/technical.md#relations-renderrelationsts).

## Verified

- `relations: 'flat'` (default) emits **nothing** for relation objects — FK scalars are
  ordinary `Field`s already in the control tree. This task only adds the `'deep'` path.
- `Relation` carries `name`, `target`, `cardinality: 'one' | 'many'`, `optional`,
  `fkFields?`; helpers `resolveRelationTarget`, `isCrossSource` exist
  ([ir-model/technical.md §Helpers](../features/ir-model/technical.md#helpers-helpersts)).
- `gen-zod` deep family exposes `createDeepSchema` / `createDeepType` / `updateDeepSchema`
  / `updateDeepType` roles
  ([generator-zod/technical.md §Relations](../features/generator-zod/technical.md#relations-renderrelationsts--two-families-decided)).

## To do

1. `packages/gen-angular/src/render/relations.ts`:
   `deepRelationControls(entity, variant, zod, logger)` — for each non-cross-source
   relation:
   - `one` → control key `relation.name`, type `FormGroup<<Target><Variant>DeepFormControls>`,
     tolerant of `undefined` when `relation.optional`;
   - `many` → control key `relation.name`, type
     `FormArray<FormGroup<<Target><Variant>DeepFormControls>>`, starts empty;
   - cross-source relation (`isCrossSource` true) → **skip** (degrade to the flat FK
     scalar) and `logger.debug(...)`.
2. Extend `render/controls.ts` so `*DeepFormControls` interfaces reference the target
   entity's `*DeepFormControls` by name (recursive/cyclic TS type refs are legal).
3. Extend `render/reactive.ts`: in `'deep'` mode the factory builds the nested groups /
   arrays; emit lazy builder helpers (`add<Relation>(): <Target><Variant>DeepForm`) so a
   cyclic entity graph never expands eagerly. The value type becomes the Zod deep DTO
   (`createDeepType` / `updateDeepType`).
4. Extend `render/signal.ts`: the model factory and `schema<...>` use the deep DTO; the
   model seeds `[]` for `many` and `undefined` / a nested seed for `one`.
5. `packages/gen-angular/src/render/*.test.ts`:
   - `relations: 'flat'` → relation names produce no control; FK scalar controls present;
   - `relations: 'deep'`: `one` → nested `FormGroup<Target…DeepFormControls>`; `many` →
     `FormArray`; an `add<Relation>()` helper is emitted;
   - cyclic fixture (`User` ↔ `Post`) TS-parses and emits lazy builders;
   - cross-source relation degrades to flat + `debug` log.
6. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [40-gen-angular-reactive-service](40-gen-angular-reactive-service.md)
- [41-gen-angular-signal-forms](41-gen-angular-signal-forms.md)
