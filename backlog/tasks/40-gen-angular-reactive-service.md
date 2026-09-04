# backend — @kurotako/gen-angular reactive factory service and Zod ValidatorFn runtime

**Status**: done **Type**: backend **Issue**: [#40](https://github.com/marmotz/kurotako/issues/40)

Reference: [../features/generator-angular/technical.md §Reactive factory service](../features/generator-angular/technical.md#reactive-factory-service-renderreactivets),
[§`zodValidator` — reactive, path-distributed errors](../features/generator-angular/technical.md#zodvalidator--reactive-path-distributed-errors-emitruntimets).

## Verified

- Emitted only when `options.forms` includes `'reactive'`.
- The single validator on the group is `zodValidator(<variant>Schema)`; no
  `Validators.*` is emitted anywhere (decided —
  [overview.md](../features/generator-angular/overview.md)).
- Zod identifiers + module specifiers come verbatim from the `zod-artifact.ts` reader
  ([38-gen-angular-scaffold](38-gen-angular-scaffold.md)); `gen-zod` v1 emits no async
  refinements so `safeParse` (sync) is enough
  ([generator-zod/technical.md](../features/generator-zod/technical.md)).

## To do

1. `packages/gen-angular/src/render/reactive.ts`:
   `reactiveEntity(entity, options, zod): string` — emits, per entity:
   - `UserCreateFormControls` / `UserUpdateFormControls` interfaces + `UserCreateForm` /
     `UserUpdateForm` aliases (via `render/controls.ts`);
   - `@Injectable({ providedIn: 'root' }) class UserFormFactory` with
     `createCreateForm(init?: Partial<UserCreateDto>): UserCreateForm` and
     `createUpdateForm(value: UserUpdateDto): UserUpdateForm`, each building a
     `new FormGroup<...>({ … }, { validators: [zodValidator(<variant>Schema)] })`;
   - imports: `Injectable` from `@angular/core`; `FormControl` / `FormGroup` (+ `FormArray`
     when deep) from `@angular/forms`; the Zod schema + DTO type from the entity module;
     enum union types from `<ns>/enums`; `zodValidator` from `<ns>/zod-forms.runtime`.
2. `packages/gen-angular/src/emit/runtime.ts` (reactive half):
   `export function zodValidator(schema: ZodType): ValidatorFn` — runs
   `schema.safeParse(group.getRawValue())`; on failure walks `error.issues`, resolves
   `group.get(issue.path.join('.'))`, merges `{ zod: issue.message }` via
   `setErrors(..., { emitEvent: false })` **only when the message changed** (loop guard),
   never clearing non-`zod` keys; pathless issues go to a group-level
   `{ zod: z.flattenError(...) }`; a successful parse clears every previously-set `zod`
   key. Deterministic hand-written source, type-only import of `ZodType` / `ZodError`.
3. `packages/gen-angular/src/render/*.test.ts`, `src/emit/*.test.ts`:
   - the group has exactly one validator, `zodValidator(<variant>Schema)`; no
     `Validators.` substring anywhere in the emitted file;
   - `createUpdateForm(value)` seeds every control from `value`;
   - `zodValidator` runtime: on a fixture `ZodError`, the control at `issue.path` receives
     `{ zod: message }`; a pathless issue lands on the group; a later valid parse clears
     the `zod` keys; a non-`zod` error key on a control survives.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [39-gen-angular-controls-variants](39-gen-angular-controls-variants.md)
- [37-gen-zod-artifact-and-run](37-gen-zod-artifact-and-run.md)
