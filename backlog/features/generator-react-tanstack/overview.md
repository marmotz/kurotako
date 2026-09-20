# React + TanStack Form generator (`@kurotako/gen-react-tanstack`)

**Status**: technical design in [technical.md](technical.md)

## Context

kurotako emits typed Angular forms (`gen-angular`) but nothing for React. The Ekoz
monorepo (`marmotz/ekoz`) uses kurotako to generate its SDK wire types and Zod
schemas from an OpenAPI document, and its demonstration web client is React
(TanStack Start). Its `auth` feature needs sign-in, registration, password-reset
and similar forms whose request bodies are already described by the generated Zod
schemas. Rather than hand-writing form state and validation for each, the client
wants them generated. The consumer-side need is written up in
[Ekoz `auth` technical design](https://github.com/marmotz/ekoz/blob/develop/backlog/features/auth/technical.md#4-form-generation-kurotako-gen-react).

## Goal

For each selected schema, generate a strongly typed **headless React hook** built on
**TanStack Form**, whose validation delegates entirely to the Zod schema emitted by
`gen-zod`, so that a React app writes only the JSX.

## Decisions made

- Package `@kurotako/gen-react-tanstack`, short name `react-tanstack`. The name
  carries the form library because React has no official forms API: the runtime
  defines the whole emitted API, so another library (for example React Hook Form)
  would be a separate package, not an option. Mirrors
  [`gen-angular`](../../_archives/features/generator-angular/overview.md): a private
  `zod` dependency, validation delegated to Zod, no validation rules derived
  from the IR.
- **Runtime target: TanStack Form** (`@tanstack/react-form`), consuming the Zod
  schema through Standard Schema. Declared as a peer dependency of the generated
  code.
- **Output shape: one headless hook per schema** (for example `useLoginDtoForm`):
  typed default values, Zod validation, per-field errors, submit. **No JSX and no
  components**: the fields (design system, i18n) stay hand-written by the consumer.
- **Consumer requirements from Ekoz** (settled here as constraints, detailed in
  `technical.md`):
  - The hook accepts an **extended or refined schema at the call site**, because
    some rules are only known at runtime (Ekoz reads the minimum password length
    from a server endpoint, and the generated schema only says `min(1)`).
  - The generator can **restrict the emitted entities** (an include list): an
    OpenAPI source yields one entity per DTO, most of them responses that need no
    form.
  - It needs **no user-declared `zod` entry**, and no dependency on the literal
    entry name `zod`: like `gen-angular`, it depends privately on `gen-zod` (a
    descriptor in `dependsOn`, see
    [implicit-generator-dependencies](../implicit-generator-dependencies/overview.md)),
    so a renamed or wrapped Zod entry in the config (Ekoz registers `zod-api`) is
    irrelevant to it. A `zodVersion` option (default `4`) selects the flavor of the
    private Zod copy.
  - Forms default to the entity's **plain schema** (request-body shape). A
    `variants` option (`full`, `create`, `update`; default `['full']`) also allows
    the `Create` / `Update` variants that `gen-angular` uses for database entities.
- **Hook shape: thin wrapper over `useForm`.** The generated hook calls a
  pre-configured `useForm` (typed default values, Zod validator) and returns the
  TanStack Form instance. Its options are limited to default values, the
  call-site schema, the validation timing, `onSubmit` and `onSubmitInvalid`; the
  returned instance gives full access afterwards. No standalone `formOptions`
  export in v1.
- **Validation timing**: TanStack `revalidateLogic`, on submit first and on
  change after a first submission, overridable per hook call.
- **Shared initial values**: the type-zero logic moves from `gen-angular` into a
  shared `@kurotako/ir` helper used by both generators.
- **Server-side errors: left to the consumer in v1.** No generated error-mapping
  helper (it would couple the generator to an API error format); the docs show the
  TanStack Form pattern for injecting field errors from `onSubmit`.
- **Relations and nested objects: flat by default, opt-in `deep` option from v1**,
  mirroring `gen-angular`'s `relations` option and driven by the Zod deep family.
  Flat mode emits scalar and enum fields only. Cross-source relations stay flat.
- **Docs**: the docs site (`apps/docs`) gets a React quickstart and option reference
  in the same increment as the package.
- Deterministic identifiers, output per namespace
  ([docs/architecture.md](../../../docs/architecture.md)); Node and Bun
  compatible, strings only (the writer owns I/O).

## Open questions

- Minimum `@tanstack/react-form` version: pinned at implementation as the lowest
  release exposing the APIs the generated code uses (not guessed here).
- Ekoz output layout: the private Zod copy lands under `<namespace>/react-tanstack/zod/`,
  so Ekoz's `zod-api` wrapper is no longer involved in the forms' imports.

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md),
  [core-pipeline](../../_archives/features/core-pipeline/overview.md).
- [generator-zod](../../_archives/features/generator-zod/overview.md) — consumed as a
  **private dependency**, declared by the generator itself.
- [implicit-generator-dependencies](../implicit-generator-dependencies/overview.md) —
  provides the private dependency mechanism and `ctx.segment`.
- Consumed by the Ekoz `auth` feature, which cannot ship its client forms until this
  package is published. Its design doc still refers to the former name `gen-react`
  (link anchor included) and must be updated on the Ekoz side.

## Feature order

After [generator-zod](../../_archives/features/generator-zod/overview.md) and
[generator-angular](../../_archives/features/generator-angular/overview.md) (the
model to follow). Time-critical for Ekoz `auth`: its server and SDK parts do not
depend on it and start first.
