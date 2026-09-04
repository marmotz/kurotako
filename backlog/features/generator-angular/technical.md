# Angular generator (`@kurotako/gen-angular`) — technical design

Design for `@kurotako/gen-angular`. Product decisions come from [overview.md](overview.md);
the generator role, the DAG and the artifact model live in
[docs/architecture.md](../../../docs/architecture.md). This document turns the overview
into a concrete package, a Zod-artifact → Angular-source mapping, and the two form
surfaces (typed reactive forms + Signal Forms) the overview settled on.

> **Amendment ([output-modes/technical.md](../output-modes/technical.md))**: this
> generator's `VirtualFile.path` prefix is **`<ns>/angular/`**, not `<ns>/` (one sub-tree
> per generator; core synthesizes `<ns>/index.ts`). Its own module specifiers gain the
> `angular/` segment (`<ns>/angular/<entity>.form`, `<ns>/angular/zod-forms.runtime`,
> `<ns>/angular` barrel). The **Zod** module specifiers it imports from now carry `zod/`
> (`<ns>/zod/<entity>.schema`, `<ns>/zod/enums`, `<ns>/zod`) — but Angular reads those
> from the Zod artifact verbatim, so this is a value change, not a code change. The
> artifact gains `peerDependencies: { '@angular/core': …, '@angular/forms': … }` (ranges:
> `>=17` reactive-only, `>=22` when `signal` is emitted — the release where
> `@angular/forms/signals` ships stable). Occurrences below are in the pre-amendment form;
> apply the segments uniformly.

## Starting point

- **No code exists.** [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) scaffolds
  `packages/gen-angular/` with a single `src/index.ts` exporting a `version` const and one
  trivial test. This feature replaces that placeholder with the real generator.
- Toolchain (from [monorepo-bootstrap/technical.md](../monorepo-bootstrap/technical.md)):
  Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS, vitest, Biome. Node >= 24.
  **No `Bun.*` API.** The generator produces **strings only** — it never touches the disk
  (core's `Writer` owns I/O,
  [core-pipeline/technical.md §Writer seam](../core-pipeline/technical.md#writer-seam)).
- Upstream contracts already designed:
  - [`@kurotako/ir`](../ir-model/technical.md) — the `IR` / `Entity` / `Field` /
    `FieldType` / `ScalarType` / `Constraints` / `Relation` / `EnumDef` types and the pure
    helpers (`iterEntities`, `iterFields`, `resolveRelationTarget`, `isCrossSource`,
    `primaryKeyFields`). The generator reads the IR **only** through these.
  - [`@kurotako/core`](../core-pipeline/technical.md) — declares `Generator`,
    `GenerateContext` (`{ ir, dependencies, logger }`, `ir` already namespace-filtered),
    `GenOutput` (`{ files: VirtualFile[]; artifact: GeneratorArtifact }`), and the fixed
    `GeneratorArtifact` / `EntitySymbols` interop shape
    ([core-pipeline/technical.md §Artifact manifest](../core-pipeline/technical.md#artifact-manifest-generatorartifact)).
    A generator owns the `<namespace>/` prefix on every `VirtualFile.path`.
  - [`@kurotako/config`](../config-system/technical.md) — the driver-facing shape is
    `TakoGenerator<O>`: an **object** with `name`, `dependsOn?`, `optionalDependsOn?`, an
    optional Valibot `optionsSchema`, and `generate(ctx, options)`. `@kurotako/config`
    validates `options` and **curries it away** before core sees a plain `Generator`
    ([config-system/technical.md](../config-system/technical.md)).
  - [`@kurotako/gen-zod`](../generator-zod/technical.md) — **hard dependency**. Exposes,
    per entity key `${ns}.${entity}`, an `EntitySymbols` (`module`,
    `symbols: Record<role, identifier>` with roles `schema` / `type` / `createSchema` /
    `createType` / `updateSchema` / `updateType` / … / `createDeepSchema` /
    `createDeepType` / …) plus `GeneratorArtifact.extra: ZodArtifactExtra`
    (`{ zodVersion, families, variants, perNamespace: { …, barrelModule, enums } }`)
    ([generator-zod/technical.md §Artifact](../generator-zod/technical.md#artifact-artifactts--the-shape-the-overview-deferred-here)).
- Downstream: [output-modes](../output-modes/overview.md) (mode B `package.json` +
  banner), [cli](../cli/overview.md) (invokes `run()`). None implemented.
- Relevant design decisions (see [docs/architecture.md](../../../docs/architecture.md)
  and [docs/glossary.md](../../../docs/glossary.md)): full generator, hard dependency
  on `zod`; deterministic identifiers, never namespace-prefixed; namespace drives output
  location only; single entry point, mode-B friendly; `generator` role, package
  `@kurotako/gen-<x>`, one short name.

## Decisions carried from the overview (recap)

- Package `@kurotako/gen-angular`, short name `angular`.
- **Hard `dependsOn: ['zod']`** — no Validators-from-IR fallback. Zod is the single source
  of validation truth.
- Two form surfaces, **both in v1**, selectable via options: typed **reactive** forms
  (`FormGroup<...>`, Angular >= 17) and **Signal Forms** (`@angular/forms/signals`, stable
  as of Angular 22).
- **Reactive surface**: one `@Injectable({ providedIn: 'root' })` factory service per
  entity (e.g. `UserFormFactory`). **Signal Forms surface**: pure exported
  `schema` + model-factory functions (the `form()` call belongs in the consumer
  component, so no DI wrapper).
- **Form variants**: `Create` (built on Zod `Create`) and `Update` (built on Zod
  `Update`, partial + primary key). No full-model form.
- **Validation delegated entirely to Zod.** No native `Validators`, no Signal Forms
  built-in rules (`required()`, `minLength()`, …) are generated. The form runs one
  Zod-delegating validator; cross-field rules and named formats are therefore covered.
- **Relations**: **flat by default** (relation FK scalars are ordinary controls; relation
  objects produce nothing). **`relations: 'deep'`** opt-in emits nested `FormGroup` for
  `one` and `FormArray` for `many`, driven by the Zod **deep** family. Cross-source
  relations always degrade to flat (consistent with
  [generator-zod/technical.md](../generator-zod/technical.md#relations-renderrelationsts--two-families-decided)).
- **Enums**: reuse the `const` array + inferred string union emitted by `gen-zod`; the
  control type is that union. Enum value validation is part of the Zod schema.
- Deterministic identifiers, output per namespace.

## Package shape

Single entry point (keeps the `exports` map identical to the bootstrap skeleton and to
what mode B emits — [docs/architecture.md](../../../docs/architecture.md)).

```
packages/gen-angular/src/
  index.ts              # barrel: angularGenerator + public types (AngularGeneratorOptions, AngularArtifactExtra)
  generator.ts          # angularGenerator: TakoGenerator<AngularGeneratorOptions>
  options.ts            # Valibot AngularGeneratorOptions schema + defaults
  errors.ts             # AngularGenError hierarchy
  names.ts              # deterministic identifier + module-specifier helpers
  zod-artifact.ts       # typed reader over ctx.dependencies.zod (EntitySymbols + ZodArtifactExtra)
  render/
    controls.ts         # entity + variant -> typed FormGroup<...> control-tree TYPE text
    reactive.ts         # entity + variant -> @Injectable factory + FormGroup builder expression
    signal.ts           # entity + variant -> exported Signal Forms schema + model factory
    relations.ts        # flat (nothing) vs deep (nested FormGroup / FormArray), cross-source degrade
  emit/
    entity.ts           # one entity -> "<ns>/angular/<entity>.form.ts" source text
    runtime.ts          # shared "<ns>/angular/zod-forms.runtime.ts" (zodValidator / zodTreeValidate helpers)
    barrel.ts           # "<ns>/angular/index.ts" re-export barrel (this generator's own sub-tree)
  artifact.ts           # assemble GeneratorArtifact (entities + peerDependencies + AngularArtifactExtra)
  *.test.ts
```

### Dependencies

| Dep | Kind | Why |
|---|---|---|
| `@kurotako/ir` | `dependencies` (`workspace:*`) | IR **types** + traversal **helpers**, used at runtime while rendering |
| `@kurotako/core` | `peerDependencies` + `devDependencies` (`workspace:*`) | `Generator` / `GenerateContext` / `GenOutput` / `GeneratorArtifact` / `EntitySymbols` **types** only |
| `@kurotako/config` | `peerDependencies` + `devDependencies` (`workspace:*`) | `TakoGenerator` **type** only |
| `@kurotako/gen-zod` | `peerDependencies` + `devDependencies` (`workspace:*`) | `ZodArtifactExtra` **type** only, re-exported for the artifact cast |
| `valibot` | `dependencies` | `optionsSchema` |

- **No `@angular/*` dependency.** The generated code imports `@angular/core`,
  `@angular/forms` and `@angular/forms/signals`; the generator only emits the source text.
  The consuming project already has Angular installed.
- **No `zod` dependency.** The generated code imports the schemas the consuming project's
  `gen-zod` output produced; this generator only emits `import` statements against the
  module specifiers reported in the Zod artifact.
- `tsconfig.json` `references`: `[{ "path": "../ir" }, { "path": "../core" },
  { "path": "../config" }, { "path": "../gen-zod" }]` — a small pin for
  [monorepo-bootstrap #6](../../tasks/6-package-skeletons.md) step 2 (doc-only until #6).
- `"sideEffects": false`.

## Public contract (`generator.ts` + `options.ts`)

```ts
import * as v from 'valibot'
import type { TakoGenerator } from '@kurotako/config'
import type { GenerateContext, GenOutput } from '@kurotako/core'

export const AngularGeneratorOptions = v.object({
  // which form surfaces to emit; default: both
  forms: v.optional(v.array(v.picklist(['reactive', 'signal'])), ['reactive', 'signal']),
  // relation handling: flat (FK scalars only) or deep (nested FormGroup / FormArray)
  relations: v.optional(v.picklist(['flat', 'deep']), 'flat'),
})
export type AngularGeneratorOptions = v.InferOutput<typeof AngularGeneratorOptions>

export const angularGenerator: TakoGenerator<AngularGeneratorOptions> = {
  name: 'angular',
  dependsOn: ['zod'],
  optionsSchema: AngularGeneratorOptions,
  generate(ctx: GenerateContext, options: AngularGeneratorOptions): GenOutput {
    // pure, synchronous: iterate ctx.ir.sources, read ctx.dependencies.zod, render text
  },
}
```

- `name: 'angular'` — the short name / config key
  ([docs/glossary.md](../../../docs/glossary.md)).
- `dependsOn: ['zod']` — **hard**. Core rejects a config that enables `angular` without
  `zod` (`UnknownDependencyError`,
  [core-pipeline/technical.md §Error model](../core-pipeline/technical.md#error-model-errorsts)),
  and the topological order guarantees `zod` runs first, so
  `ctx.dependencies.zod` is **always present** in `generate`.
- `generate` is **synchronous and pure**: same IR + same Zod artifact + same options →
  deep-equal `GenOutput` (required by [drift-guard](../drift-guard/overview.md)). No
  `parseAsync` at generation time and none in the generated code (v1 `gen-zod` emits no
  async refinements — [generator-zod/technical.md](../generator-zod/technical.md)).
- **Options minimal for v1**: `forms` and `relations` only. `providedIn: 'root'` is fixed
  (not configurable); service/type names are fixed by
  [docs/architecture.md](../../../docs/architecture.md).
- `dependsOn: ['zod']` with `forms: []` is still valid (emits types + models, no form
  builder) but pointless; documented, not rejected.

## Naming (`names.ts`) — deterministic, never namespace-prefixed

Entity `User` ([docs/architecture.md](../../../docs/architecture.md)):

| Concept | `Create` | `Update` |
|---|---|---|
| control-tree type (reactive) | `UserCreateFormControls` | `UserUpdateFormControls` |
| `FormGroup` type alias (reactive) | `UserCreateForm` = `FormGroup<UserCreateFormControls>` | `UserUpdateForm` |
| factory service (reactive) | `UserFormFactory` (one service, both methods) | — |
| service method (reactive) | `createCreateForm(init?)` | `createUpdateForm(value)` |
| Signal Forms schema | `userCreateFormSchema` | `userUpdateFormSchema` |
| Signal Forms model factory | `createUserCreateModel(init?)` | `createUserUpdateModel(value)` |
| value / model type | Zod `UserCreateDto` (imported) | Zod `UserUpdateDto` (imported) |

- **No form-model interface is emitted** — the value type is the Zod inferred DTO,
  imported from the `gen-zod` module. This is the concrete answer to the overview's
  "reuse the inferred type" and to
  [docs/vision.md open question §3](../../../docs/vision.md#open-questions): Angular
  consumes `ctx.dependencies.zod.entities['<ns>.User'].symbols` + `extra`, **never raw
  file paths**.
- Deep variant control-tree types (only with `relations: 'deep'`):
  `UserCreateDeepFormControls`, alias `UserCreateDeepForm`, model type
  `UserCreateDeepDto` (imported). Method names gain no suffix — the option decides which
  tree the single `UserFormFactory` builds.
- **Module specifiers** (POSIX, extension-less): `<ns>/<entity>.form` per entity,
  `<ns>/zod-forms.runtime` for the shared helper, `<ns>` for the barrel. Emitted verbatim
  into generated `import`s and reported in the artifact.
- Zod imports in a generated `<entity>.form.ts` come from
  `ctx.dependencies.zod.entities[k].module` (e.g. `pg/user.schema`) and
  `extra.perNamespace[ns].barrelModule`; the identifiers come from `symbols` verbatim.
  The generator never re-derives a Zod name.

## File layout (per namespace `<ns>`)

Namespace drives location only ([docs/architecture.md](../../../docs/architecture.md)):

```
generated/<ns>/
  zod-forms.runtime.ts   # zodValidator (reactive ValidatorFn) + zodTreeValidate (Signal Forms tree validator)
  <entity>.form.ts       # one per entity: control-tree types + UserFormFactory + Signal Forms schema/model
  index.ts               # barrel: export * from every file above
```

- `zod-forms.runtime.ts` is emitted once per namespace whenever the source has >= 1 entity
  **and** `forms` is non-empty. It is hand-written, deterministic source (no per-entity
  content), and depends only on `@angular/forms` (+ `@angular/forms/signals` when
  `signal` is enabled) and `zod` (type-only import of `ZodType` / `ZodError`).
- One file per entity (not per variant) keeps the import graph flat; the deep family's
  cross-entity references are plain TS type references (recursive interfaces are legal)
  and, at runtime, lazily constructed `FormArray` / nested `FormGroup`.
- A source with **zero entities** still emits an `index.ts` (possibly an empty barrel);
  no runtime file.

## Zod artifact → Angular source mapping

Everything is text assembly. Entities and fields are iterated in `@kurotako/ir` key order
(`iterEntities` / `iterFields`) for determinism.

### Control type per scalar (`render/controls.ts`)

A reactive typed `FormControl<T>`'s `T` mirrors the **Zod inferred type of that field**,
which the generator reconstructs from the IR `Field` (not by parsing Zod text):

| IR `Field` | `FormControl` type argument |
|---|---|
| `scalar: 'string' \| 'uuid' \| 'decimal' \| 'bytes'` | `string` |
| `scalar: 'int' \| 'float'` | `number` |
| `scalar: 'bigint'` | `bigint` |
| `scalar: 'boolean'` | `boolean` |
| `scalar: 'date' \| 'datetime'` | `Date` |
| `scalar: 'json'` | `unknown` |
| `type.kind === 'enum'` (ref `Role`) | the Zod-emitted union type `Role` (imported from `<ns>/enums`) |
| `type.kind === 'unknown'` | `unknown` |
| `field.list` | `T[]` |
| `field.nullable` | `T \| null` |

- Nullability: a nullable field's control is `new FormControl<T | null>(v ?? null)`;
  Angular's default `FormControl` is already nullable, so a **non-nullable** field uses
  `nonNullable: true` and `FormControl<T>`. This matches the Zod `.nullable()` /
  non-nullable distinction the IR carries as `Field.nullable`.
- Enum control type is the string union `gen-zod` already exports; the generator imports
  it rather than re-declaring.

### Variant field sets

| Variant | Fields (scalar / enum) | Optionality |
|---|---|---|
| `Create` | all except fields whose only value source is db-side (primary key with an `expr` default, `expr`-default fields) — same rule as the Zod `Create` variant | a field that is `optional` in the Zod `Create` DTO → its control is added but `init` may omit it; a literal `default` seeds the control's initial value |
| `Update` | full field set **minus primary key**, every control optional | `createUpdateForm(value)` seeds every control from `value`; controls map to the Zod `Update` (partial) DTO |

- The generator gets these sets from **`@kurotako/ir`'s shared-decision helpers**
  (`createFields`, `isCreateOptional`, `updateFields`, `isDbAssigned`, `scalarTsType` —
  [ir-model/technical.md §Shared-decision helpers](../ir-model/technical.md#shared-decision-helpers-helpersts)),
  the **same** helpers `gen-zod` calls. The control tree and the Zod schema it delegates
  validation to therefore agree **by construction**, not by two implementations happening
  to match. `render/controls.ts` only maps the resulting field list to `FormControl<T>`
  entries.

### Relations (`render/relations.ts`)

| `relations` option | to-one relation | to-many relation |
|---|---|---|
| `flat` (default) | nothing — `relation.fkFields` are ordinary scalar `Field`s already in the control tree | nothing |
| `deep` | nested `FormGroup<TargetCreateDeepFormControls>` (or `…Update…`), control key = `relation.name`; `undefined`-tolerant when `relation.optional` | `FormArray<FormGroup<TargetCreateDeepFormControls>>`, control key = `relation.name`, starts empty |
| `deep`, cross-source (`isCrossSource` true) | **degrades to flat** (FK scalar only) + `debug` log | same |

- Deep control-tree **types** reference the target entity's `…DeepFormControls` interface
  by name; TS handles the resulting recursive/cyclic type references. Deep **runtime**
  construction: `FormArray` items and nested `FormGroup`s are built on demand by helper
  methods on the factory (`addPost(): UserPostDeepForm`), never eagerly, so a cyclic
  entity graph cannot infinitely expand.
- The value/model type in deep mode is the Zod **deep** DTO
  (`UserCreateDeepDto`), imported via the `createDeepType` / `updateDeepType` role.

### Reactive factory service (`render/reactive.ts`)

Per entity, emitted when `forms` includes `'reactive'`:

```ts
import { Injectable } from '@angular/core'
import { FormControl, FormGroup, FormArray } from '@angular/forms'
import { UserCreateSchema, UserUpdateSchema } from './user.schema'          // roles: createSchema / updateSchema
import type { UserCreateDto, UserUpdateDto } from './user.schema'           // roles: createType / updateType
import { Role } from './enums'
import { zodValidator } from './zod-forms.runtime'

export interface UserCreateFormControls {
  email: FormControl<string>
  role: FormControl<Role>
  // ...one entry per Create-variant field
}
export type UserCreateForm = FormGroup<UserCreateFormControls>

export interface UserUpdateFormControls { /* ...Update-variant fields, all present */ }
export type UserUpdateForm = FormGroup<UserUpdateFormControls>

@Injectable({ providedIn: 'root' })
export class UserFormFactory {
  createCreateForm(init?: Partial<UserCreateDto>): UserCreateForm {
    return new FormGroup<UserCreateFormControls>({
      email: new FormControl(init?.email ?? '', { nonNullable: true }),
      role:  new FormControl(init?.role  ?? 'USER', { nonNullable: true }),
      // ...
    }, { validators: [zodValidator(UserCreateSchema)] })
  }

  createUpdateForm(value: UserUpdateDto): UserUpdateForm { /* symmetric, seeded from value */ }
}
```

- The **only** validator on the group is `zodValidator(<variant>Schema)`. No
  `Validators.required`, `Validators.minLength`, `Validators.pattern`, … are emitted.
- Initial values: literal `Field.default` (`DefaultValue.kind === 'value'`) seeds the
  control; otherwise `'' / 0 / false / null` per the control type. `expr` defaults seed
  nothing (server-assigned).

### `zodValidator` — reactive, path-distributed errors (`emit/runtime.ts`)

Shared, hand-written, deterministic. Behaviour (documented so the task implements it
exactly):

```ts
// zod-forms.runtime.ts (shape)
import type { AbstractControl, ValidatorFn } from '@angular/forms'
import type { ZodType } from 'zod'

export function zodValidator(schema: ZodType): ValidatorFn {
  return (group: AbstractControl) => {
    const res = schema.safeParse(group.getRawValue())
    // 1. clear stale `zod` errors set by a previous run on any descendant control
    // 2. on success: return null
    // 3. on failure: for each issue, resolve group.get(issue.path.join('.')):
    //      - control found -> merge { zod: issue.message } into control.errors via
    //        setErrors(..., { emitEvent: false })   (guarded: only when changed, to avoid a validator loop)
    //      - no control (cross-field / root issue) -> collect into the group-level error
    //    return { zod: { formErrors, fieldErrors } }  (z.flattenError shape) or null if only descendant errors
  }
}
```

- **Loop guard**: `setErrors` inside a group validator re-triggers validation; the helper
  compares the incoming `zod` message to the control's current one and calls `setErrors`
  with `{ emitEvent: false }` only on a real change, and never clears non-`zod` error keys.
- `getRawValue()` (not `value`) so disabled controls are still validated by Zod.
- This is the concrete answer to the overview open question "how Zod issues map onto
  individual controls": **path-based distribution**, group-level fallback for
  pathless / cross-field issues.

### Signal Forms schema + model factory (`render/signal.ts`)

Per entity, emitted when `forms` includes `'signal'`:

```ts
import { schema } from '@angular/forms/signals'
import { UserCreateSchema } from './user.schema'
import type { UserCreateDto } from './user.schema'
import { zodTreeValidate } from './zod-forms.runtime'

export function createUserCreateModel(init?: Partial<UserCreateDto>): UserCreateDto {
  return { email: init?.email ?? '', role: init?.role ?? 'USER', /* ... */ }
}

export const userCreateFormSchema = schema<UserCreateDto>((path) => {
  zodTreeValidate(path, UserCreateSchema)   // ONE root tree validator; no required()/minLength()/... rules
})
```

- The consumer calls `form(signal(createUserCreateModel()), userCreateFormSchema)` in its
  component — the generator does not emit the `form()` call or any component.
- `zodTreeValidate(path, schema)` (shared runtime) wraps the Signal Forms tree-level
  validator API: it runs `schema.safeParse(rootValue)` and returns the issues mapped to
  descendant fields by `issue.path` (Signal Forms' tree validator can attach errors to
  nested fields), with pathless issues attached to the root. No built-in metadata keys
  (`REQUIRED`, `MIN_LENGTH`, …) are populated — the overview settled that `field().required()`
  & co. are **not** available from the generated schema.
- **Secondary-API churn**: `@angular/forms/signals` is stable as of Angular 22; a few
  secondary APIs may still move on a minor. The runtime helper isolates every Signal Forms
  call site to one file, so any such change is a single-file update. The generated
  per-entity file only references `schema` and the helper.

### Enums

`FieldType.kind === 'enum'` (ref `Role`): the control/model type is the union type `Role`
exported by `gen-zod` (`extra.perNamespace[ns].enums['Role'].typeName`, imported from
`extra.perNamespace[ns].enums['Role'].module`, i.e. `<ns>/enums`). No TS `enum`, no
re-declaration. Enum value validation lives in the Zod schema.

## Artifact (`artifact.ts`)

Fills the core-imposed `GeneratorArtifact`
([core-pipeline/technical.md §Artifact manifest](../core-pipeline/technical.md#artifact-manifest-generatorartifact)):

```ts
import type { GeneratorArtifact, EntitySymbols } from '@kurotako/core'

// artifact.peerDependencies === options.forms includes 'signal'
//   ? { '@angular/core': '>=22', '@angular/forms': '>=22' }
//   : { '@angular/core': '>=17', '@angular/forms': '>=17' }
// entities: key === `${namespace}.${entity}`
// EntitySymbols.module === `${namespace}/angular/${entity}.form`   (post-amendment)
// EntitySymbols.symbols keyed by role:
//   createControls, createForm, updateControls, updateForm, factory,
//   createSchema (SF), updateSchema (SF), createModel, updateModel
//   (+ createDeepControls / createDeepForm / ... when relations: 'deep')

export interface AngularArtifactExtra {
  forms: ('reactive' | 'signal')[]
  relations: 'flat' | 'deep'
  zodVersion: 3 | 4                      // echoed from the consumed ZodArtifactExtra
  perNamespace: Record<string, {
    runtimeModule: string               // `${ns}/zod-forms.runtime`
    barrelModule: string                // `${ns}`
  }>
}
```

- No generator depends on `angular` in v1, so the artifact exists only for uniformity and
  future consumers (an `@kurotako/gen-storybook` or an app-scaffold generator).
- `GeneratorArtifact.extra` is `AngularArtifactExtra`, re-exported from the barrel.

## Determinism

Required by [drift-guard](../drift-guard/overview.md):

- `ctx.ir` is already namespace-filtered and key-ordered by core; the generator preserves
  that order and never sorts entities/fields.
- `import` statements in each emitted file sorted by module specifier; named imports
  sorted.
- no timestamps, no absolute paths, no `Date.now()`; the "generated, do not edit" banner
  is [output-modes](../output-modes/overview.md)' concern.
- `generate` is synchronous and reads nothing outside `ctx` (IR + Zod artifact + options).

## What stays out of this feature

- **Namespace filtering, DAG order, `VirtualFile` collision detection, the `Writer`, the
  "do not edit" banner, per-namespace `package.json` (mode B)** —
  [core-pipeline](../core-pipeline/overview.md) / [output-modes](../output-modes/overview.md).
- **The Zod schemas themselves, their file layout, the `Where` / `Select` variants** —
  [generator-zod](../generator-zod/technical.md). This feature consumes `Create` /
  `Update` (+ their `Deep` forms) only.
- **The `IR` types, validation, traversal helpers** — [`@kurotako/ir`](../ir-model/technical.md).
- **Driver-option file syntax / validation plumbing** — [config-system](../config-system/technical.md).
- **Generated Angular components, `form()` call sites, template markup, routing, a
  scaffolded app** — out of scope; the generator emits form *building blocks* only.
- **Async validators / `parseAsync`, debounced server-side uniqueness checks, native
  `Validators` mirror, Signal Forms built-in metadata rules, a full-model form,
  `providedIn` other than `'root'`, an override for the scalar→control type map** —
  post-v1 evolutions, explicitly out.

## Alternatives considered

- **Emit only reactive forms in v1, Signal Forms later.** Rejected by the user — both in
  v1. Cost is contained: Signal Forms call sites live only in `render/signal.ts` +
  `emit/runtime.ts`.
- **Emit only Signal Forms.** Rejected — reactive typed forms are the current stable API
  and what most Angular 17–19 apps use.
- **Pure functions for the reactive surface too** (no `@Injectable`). Rejected by the
  user — the reactive factory is a `providedIn: 'root'` service; only Signal Forms, whose
  API is function-based, stays function-only.
- **Generate native `Validators` (required / minLength / pattern / min / max / enum) from
  the IR** in addition to the Zod validator. Rejected by the user — Zod covers everything;
  a parallel validator set risks divergence and doubles the mapping surface.
- **Generate Signal Forms built-in rules** (`required()`, `email()`, `minLength()`, …)
  mirroring the IR for template metadata (`field().required()` markers). Rejected by the
  user — one root `validate`-style tree validator delegating to Zod, nothing else.
- **Group-level-only Zod errors** (`{ zod: flatten() }` on the `FormGroup`, no per-control
  state). Rejected by the user — issues are distributed onto the matching controls by
  path, with a group-level fallback for cross-field issues.
- **Deep nesting by default.** Reversed by the user during technical discussion — flat by
  default (`relations: 'flat'`), deep is opt-in. Rationale: most forms edit one entity and
  reference relations by id; deep trees multiply control count and complicate cyclic
  graphs.
- **Emit a hand-written form-model interface per entity.** Rejected — the value type is
  the Zod inferred DTO, imported. Keeps one source of truth and satisfies "reuse the
  inferred type".
- **Re-parse the generated Zod source text to derive control types.** Rejected — the
  generator reconstructs field types from the IR (which `gen-zod` also used), and only
  consumes *identifiers + module specifiers* from the Zod artifact. No text parsing, fully
  deterministic.
- **Read `gen-zod`'s output file paths directly.** Rejected by the core contract —
  dependents consume `EntitySymbols` + `extra`, never raw paths
  ([core-pipeline/technical.md](../core-pipeline/technical.md#artifact-manifest-generatorartifact)).
- **Optional `optionalDependsOn: ['zod']` with an IR fallback** (the original overview /
  [docs/architecture.md](../../../docs/architecture.md) sketch). Reversed by the user —
  hard `dependsOn: ['zod']`, no fallback.

## Accepted limitations (v1)

- **Signal Forms API is stable as of Angular 22**; a few secondary APIs may still change
  on a minor, in which case the generated `signal` output needs a regen. Isolated to the
  runtime helper + `render/signal.ts`; the maintainer tracks Angular releases.
- **No per-field validation state from constraints** — `field().required()` /
  `control.hasError('required')` are not populated; the UI reads errors from the single
  `zod` error key (reactive) or the tree validator's field errors (Signal Forms).
- **Deep cross-source relations degrade to FK id** (same as `gen-zod`).
- **`bigint` / `Date` / `unknown` controls** carry no coercion — the control holds
  whatever the template binding provides; Zod `z.coerce.date()` on the schema side does
  the coercion at validation time.
- **The generated tree assumes the consuming project has `@angular/core`,
  `@angular/forms`, and (for `signal`) `@angular/forms/signals` installed**, plus the
  `gen-zod` output on the resolvable module paths the Zod artifact reports.

## Consequences verified against the repo / other features

- Nothing to migrate: `packages/gen-angular/src/index.ts` is the bootstrap placeholder
  ([task #6](../../tasks/6-package-skeletons.md)). This feature rewrites it;
  `package.json` gains `@kurotako/ir` (`workspace:*`), the `@kurotako/core` /
  `@kurotako/config` / `@kurotako/gen-zod` peers, and `valibot`. `tsconfig.json` gains the
  four `references`.
- **[generator-zod/technical.md](../generator-zod/technical.md)** — currently states the
  Angular consumer is **optional** (`optionalDependsOn: ['zod']`). This feature makes it
  **hard** (`dependsOn: ['zod']`). Consequence: `gen-zod`'s artifact is now a *required*
  contract, not a nice-to-have; its `Create` / `Update` / `*Deep*` roles and
  `ZodArtifactExtra.perNamespace[ns].enums` are consumed here. `gen-zod` needs no code
  change — only its overview/technical prose updated to say "hard downstream dependency"
  (overview already updated; technical.md prose to reconcile when this lands).
- **[core-pipeline/technical.md](../core-pipeline/technical.md)** — `angularGenerator`
  matches `Generator` (`name`, `dependsOn: ['zod']`, `generate(ctx)` after config
  currying). Core's ordering + presence check guarantees `ctx.dependencies.zod`. It
  returns `{ files, artifact }` with `<ns>/angular/`-prefixed POSIX paths
  ([output-modes](../output-modes/technical.md) amendment) and
  `artifact.peerDependencies` for the mode-B `package.json`. No core code change beyond
  the amendments output-modes already records.
- **[ir-model/technical.md](../ir-model/technical.md)** — consumes `primaryKeyFields`,
  `Field.default` (both `DefaultValue` kinds), `Field.optional` / `Field.nullable`,
  `Relation.cardinality` / `optional` / `fkFields` / `name`, `isCrossSource`,
  `resolveRelationTarget`, enum refs. No IR change required.
- **[config-system/technical.md](../config-system/technical.md)** —
  `AngularGeneratorOptions` is a plain Valibot object; `@kurotako/config` validates and
  curries it. `TakoGenerator.dependsOn` already exists in that contract (line 91).
- **[docs/architecture.md](../../../docs/architecture.md) §"Generators and DAG"** — the
  prose says `gen-angular`'s `zod` dependency is *optional* ("reuses the Zod DTOs if
  present, generates its own `Validators` from the IR otherwise"). That is now **wrong**;
  the dependency is hard and there is no IR-`Validators` path. Reconcile the prose when
  this feature lands (doc-only change, not this phase). The diagram line
  `gen-angular (dependsOn: zod)` is already correct.
- **[docs/vision.md open question §9](../../../docs/vision.md#open-questions)** (Angular
  target versions, typed-forms API, `Validators` ↔ IR alignment) is answered on the
  generator side: Angular >= 17 (reactive) / >= 22 (Signal Forms), typed forms mandatory,
  and the `Validators` ↔ IR mapping is **replaced** by full delegation to the Zod schema.
- **[overview.md](overview.md)** — one decision reversed to record there: relations are
  **flat by default**, deep is an opt-in `relations: 'deep'` option (the overview
  currently says "full nesting"). Also: effective minimum Angular version is 22 (the
  `@angular/forms/signals` stable release) when the `signal` surface is emitted.

## Tests (vitest, colocated)

Fixture-driven: hand-built `IR` objects + a hand-built `GeneratorArtifact` standing in for
`gen-zod`, fed through `angularGenerator.generate`, asserting emitted **source text** and
**artifact structure** (targeted substring / TS-parse assertions, not brittle full-file
snapshots).

- **control types**: every `ScalarType` → expected `FormControl<T>` arg; `nullable` →
  `T | null` + nullable control; non-nullable → `nonNullable: true`; `list` → `T[]`; enum
  field → imported union type, no re-declaration.
- **variants**: `Create` drops the `expr`-default primary key and seeds literal defaults;
  `Update` omits the primary key and every control is present/seeded from `value`; the
  control set equals the corresponding Zod variant's field set for the same fixture.
- **validation**: the group has exactly one validator, `zodValidator(<variant>Schema)`;
  **no** `Validators.*` appears anywhere in the file; the Signal Forms schema body
  contains exactly one `zodTreeValidate(path, <variant>Schema)` and no `required(` /
  `minLength(` / `email(`.
- **`zodValidator` runtime**: on a fixture `ZodError`, descendant control at
  `issue.path` receives `{ zod: message }`; a pathless issue lands on the group;
  a subsequent valid parse clears the `zod` keys; a non-`zod` error key on a control is
  left intact.
- **relations flat**: `relations: 'flat'` → relation names produce no control; FK scalar
  controls present.
- **relations deep**: `one` → nested `FormGroup<Target…DeepFormControls>`; `many` →
  `FormArray`; an `addX()` helper is emitted; cyclic fixture (`User` ↔ `Post`) compiles
  (TS-parse) and emits lazy builders; cross-source relation degrades to flat + `debug`
  log.
- **forms option**: `forms: ['reactive']` → no `@angular/forms/signals` import, no
  `schema<...>`; `forms: ['signal']` → no `@Injectable`, no `FormGroup`; `forms: []` →
  types + models only, no runtime file.
- **enums**: control type is the Zod union, imported from `<ns>/enums` per the artifact
  `extra`.
- **imports**: Zod identifiers + module specifiers taken verbatim from the fake artifact;
  import lines sorted; barrel re-exports every file.
- **artifact**: `entities` keyed `${ns}.${entity}`, `module === '<ns>/<entity>.form'`,
  every expected role in `symbols`; `extra.forms` / `extra.relations` echo the options;
  `extra.zodVersion` echoes the consumed Zod artifact.
- **determinism**: same IR + artifact + options → deep-equal `GenOutput` on a second call;
  entity/field order preserved.
- **hard dep**: (core-level test, cross-referenced) `angular` without `zod` in the config
  → `UnknownDependencyError` — asserted in `core-pipeline`'s graph tests, noted here.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#38 gen-angular-scaffold](../../tasks/38-gen-angular-scaffold.md) — `package.json`
   deps, `tsconfig` refs, `src/options.ts` (`AngularGeneratorOptions`), `src/errors.ts`,
   `src/names.ts`, `src/zod-artifact.ts` (typed reader over `ctx.dependencies.zod`),
   `src/generator.ts` skeleton, barrel (deps: #6, #11, #15, #22, #32).
2. [#39 gen-angular-controls-variants](../../tasks/39-gen-angular-controls-variants.md) —
   `src/render/controls.ts` (scalar → `FormControl<T>` map, nullable/list/`nonNullable`,
   control-tree interfaces) + variant field sets (`Create` / `Update`) derived from the IR
   to match `gen-zod` (deps: #38, #13).
3. [#40 gen-angular-reactive-service](../../tasks/40-gen-angular-reactive-service.md) —
   `src/render/reactive.ts` (`@Injectable` factory, `FormGroup` builder) +
   `src/emit/runtime.ts` `zodValidator` (path-distributed `ValidatorFn`) (deps: #39, #37).
4. [#41 gen-angular-signal-forms](../../tasks/41-gen-angular-signal-forms.md) —
   `src/render/signal.ts` (`schema<...>` + model factory) + `src/emit/runtime.ts`
   `zodTreeValidate` (root tree validator, no built-in rules) (deps: #39, #37).
5. [#42 gen-angular-relations-deep](../../tasks/42-gen-angular-relations-deep.md) —
   `src/render/relations.ts` (`relations: 'deep'`: nested `FormGroup` / `FormArray`, lazy
   builders, cross-source degrade) + deep control-tree types (deps: #40, #41).
6. [#43 gen-angular-emit-artifact-run](../../tasks/43-gen-angular-emit-artifact-run.md) —
   `src/emit/entity.ts` + `barrel.ts`, `src/artifact.ts` (`GeneratorArtifact` +
   `AngularArtifactExtra`), `generate()` wiring over `ctx.ir.sources`, end-to-end +
   determinism tests (dep: #42).
