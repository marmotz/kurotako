# backend — @kurotako/gen-angular Signal Forms schema, model factory and tree validator

**Status**: done **Type**: backend **Issue**: [#41](https://github.com/marmotz/kurotako/issues/41)

Reference: [../features/generator-angular/technical.md §Signal Forms schema + model factory](../features/generator-angular/technical.md#signal-forms-schema--model-factory-rendersignalts),
[§`zodValidator` — reactive, path-distributed errors](../features/generator-angular/technical.md#zodvalidator--reactive-path-distributed-errors-emitruntimets)
(the `zodTreeValidate` half).

## Verified

- Emitted only when `options.forms` includes `'signal'`.
- `@angular/forms/signals` is **stable as of Angular 22**; a few secondary APIs may still
  move on a minor, so every call site must live in `render/signal.ts` + `emit/runtime.ts`
  to keep any follow-up a one-file update
  ([overview.md](../features/generator-angular/overview.md)).
- The generated schema contains exactly **one** root tree validator delegating to Zod —
  no `required()` / `minLength()` / `email()` / other built-in rules (decided).
- The generator does **not** emit the `form()` call or any component.

## To do

1. `packages/gen-angular/src/render/signal.ts`:
   `signalEntity(entity, options, zod): string` — emits, per entity and per variant
   (`Create` / `Update`):
   - `export function create<Entity><Variant>Model(init?): <Zod DTO>` returning the plain
     object seeded like the reactive controls (literal defaults, type zeros);
   - `export const <entity><Variant>FormSchema = schema<<Zod DTO>>((path) => {
     zodTreeValidate(path, <Zod schema>) })`;
   - imports: `schema` from `@angular/forms/signals`; the Zod schema + DTO type from the
     entity module; `zodTreeValidate` from `<ns>/zod-forms.runtime`.
2. `packages/gen-angular/src/emit/runtime.ts` (Signal Forms half):
   `zodTreeValidate(path, schema)` — wraps the Signal Forms tree-level validator API:
   runs `schema.safeParse(<root value>)`, maps each `issue` to the descendant field by
   `issue.path`, attaches pathless issues to the root. No metadata keys populated.
   Deterministic hand-written source; the only file importing `@angular/forms/signals`
   validator primitives.
3. `packages/gen-angular/src/render/*.test.ts`:
   - `forms: ['signal']` → no `@Injectable`, no `FormGroup`; `forms: ['reactive']` → no
     `@angular/forms/signals` import, no `schema<...>`;
   - the schema body contains exactly one `zodTreeValidate(path, <variant>Schema)` and no
     `required(` / `minLength(` / `email(`;
   - `create<Entity>CreateModel()` returns the seeded object;
   - the model type is the imported Zod `Create` / `Update` DTO.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [39-gen-angular-controls-variants](39-gen-angular-controls-variants.md)
- [37-gen-zod-artifact-and-run](37-gen-zod-artifact-and-run.md)
