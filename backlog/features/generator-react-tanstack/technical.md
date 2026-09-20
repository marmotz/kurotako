# React + TanStack Form generator — technical design

Product decisions: [overview.md](overview.md). Cross-cutting model:
[docs/architecture.md](../../../docs/architecture.md), [docs/ir.md](../../../docs/ir.md).
The package mirrors [`gen-angular`](../../_archives/features/generator-angular/technical.md).

## Current state (verified)

- `gen-angular` is the template: `defineGenerator({ name, dependsOn: ['zod'], optionsSchema,
  generate })`, one `<Entity>.form.ts` per entity, a per-namespace runtime file, a sub-tree
  barrel, and `buildArtifact` ([generator.ts:17](../../../packages/gen-angular/src/generator.ts),
  [artifact.ts](../../../packages/gen-angular/src/artifact.ts)). It reads the Zod artifact through a
  typed reader ([zod-artifact.ts](../../../packages/gen-angular/src/zod-artifact.ts)) and emits
  cross-generator imports with the artifact's `module` verbatim (`tasks/zod/Task.schema`), resolved
  by the output mode ([writer/package.ts:354](../../../packages/core/src/writer/package.ts)).
- The Zod artifact exposes per entity the roles `schema`/`type` (plain), `createSchema`/`createType`,
  `updateSchema`/`updateType` and the `*Deep*` equivalents
  ([gen-zod artifact.ts:66](../../../packages/gen-zod/src/artifact.ts)); the plain schema covers every
  entity field ([variants.ts:31](../../../packages/gen-zod/src/render/variants.ts)). Type names are
  `${Entity}Dto`, so an OpenAPI entity `LoginDto` yields `LoginDtoSchema` / `LoginDtoDto`.
- The dependency name is a static array: `TakoGenerator.dependsOn?: string[]`
  ([config/types.ts:53](../../../packages/config/src/types.ts)), copied as is at
  [load.ts:183](../../../packages/config/src/load.ts); core requires an entry with that exact name
  ([graph.ts:43](../../../packages/core/src/graph.ts)) and passes artifacts keyed by dependency name
  ([run.ts:98](../../../packages/core/src/run.ts)). A renamed Zod entry (Ekoz registers `zod-api`, see
  [its tako.config.ts](https://github.com/marmotz/ekoz/blob/develop/tako.config.ts)) therefore breaks a
  hard-coded `['zod']`.
- The initial-value logic (`zeroValue` / `initExpr`) lives in `gen-angular`
  ([controls.ts:105,152](../../../packages/gen-angular/src/render/controls.ts)), while the shared
  decisions (`createFields`, `updateFields`, `defaultValueExpr`) already live in `@kurotako/ir`
  ([helpers.ts:302-340](../../../packages/ir/src/helpers.ts)).
- Verified against the TanStack Form docs (Context7, `/tanstack/form`): Standard Schema validators are
  accepted at form level; `onSubmit` receives the **input** values, not the schema output;
  `revalidateLogic({ mode, modeAfterSubmission })` drives the `onDynamic` validator; field errors can be
  set from a form validator or `setErrorMap`, with dotted / indexed paths (`'details.email'`,
  `'socials[0].url'`); `@tanstack/react-form` declares `react` `^17 || ^18 || ^19`.

## Scope decisions

- **Implicit generator dependencies are out of scope.** Letting a generator instantiate its own
  dependency (`gen-react-tanstack` pulling `gen-zod` without a user-declared entry) reverses the locked
  "hard `dependsOn`, absent => reject" rule and raises unresolved questions (naming, merging with an
  explicit entry, output segment). It becomes the separate feature
  [implicit-generator-dependencies](../implicit-generator-dependencies/overview.md). This feature ships
  with the minimal mechanism below and drops it when that feature lands.
- **The renamed-segment mismatch stays on the Ekoz side.** Ekoz's `zod-api` wrapper rewrites emitted
  file paths but not the artifact's `module` values, so imports to `api/zod/...` would not resolve.
  The wrapper must also rewrite `artifact.entities[*].module` and
  `artifact.extra.perNamespace[*].{enumsModule,filtersModule,barrelModule}` (and `enums[*].module`). This
  generator consumes the artifact as published. A configurable per-instance segment belongs to
  `implicit-generator-dependencies`.

## Package

`packages/gen-react-tanstack`, `@kurotako/gen-react-tanstack`, generator `name: 'react-tanstack'`, output
sub-tree `<namespace>/react-tanstack/`. Layout copied from `gen-angular` (`package.json` with
`@kurotako/{config,core,gen-zod}` as workspace peers and `@kurotako/ir`, `valibot` as dependencies,
`tsup.config.ts` re-exporting `basePreset`, `tsconfig.json` with references `ir`, `core`, `config`,
`gen-zod`, `vitest.config.ts`). Registered in the root `tsconfig.json` references; the root
`vitest.config.ts` already globs `packages/*/vitest.config.ts` and `release-publish.sh` globs
`packages/*/package.json`. No `Bun.*` API (Node and Bun compatible).

Source layout:

```
src/
  index.ts            driver, options schema/type, artifact-extra type, error classes
  generator.ts        reactTanstackGenerator
  options.ts          ReactTanstackGeneratorOptions (Valibot)
  names.ts            identifiers + module specifiers
  zod-artifact.ts     typed reader over the Zod artifact (dependency name from options)
  artifact.ts         buildArtifact
  errors.ts           ReactTanstackGenError + subclasses
  emit/entity.ts      one <Entity>.form.ts
  emit/runtime.ts     form.runtime.ts (the only file calling @tanstack/react-form)
  emit/barrel.ts      index.ts
  render/             defaults (default values), relations (deep), imports (ImportsRecorder)
  testing/            IR fixtures, helpers
```

## Config and core change: dependency name from options

Minimal, no change to `@kurotako/core`:

- `defineGenerator` and `TakoGenerator` accept `dependsOn` and `optionalDependsOn` as
  `string[] | ((options: DriverOptions<S>) => string[])`
  ([define-driver.ts:52](../../../packages/config/src/define-driver.ts),
  [types.ts:53](../../../packages/config/src/types.ts)).
- `load.ts` resolves the function against the already-validated options when it builds the curried
  `Generator` ([load.ts:180](../../../packages/config/src/load.ts)); core keeps seeing `string[]`. A
  function that throws or returns a non-array is wrapped in `DriverOptionsError`-style config error.
- `gen-react-tanstack` declares `dependsOn: (options) => [options.zod]` and reads
  `ctx.dependencies[options.zod]`. Default `zod: 'zod'`, so a plain config needs nothing extra.
- Tests: `config/src/define.test.ts`, `load.test.ts`, `define.test-d.ts` (type-level: the function
  receives the schema Output; static arrays still typecheck). `gen-angular` is untouched.
- Changeset: `@kurotako/config` minor (new public API).

Alternatives rejected: a fixed `'zod'` (breaks the Ekoz requirement); a role/`provides` mechanism in
core (larger core contract change, superseded by implicit dependencies).

## Options

`ReactTanstackGeneratorOptions` (Valibot `v.object`, like `gen-angular`):

| Option | Type | Default | Meaning |
|---|---|---|---|
| `zod` | `string` | `'zod'` | Name of the `generators` entry that provides the Zod artifact. |
| `include` | `string[]` | all entities | Entity names to emit hooks for, applied to every namespace the generator covers. |
| `variants` | `('full' \| 'create' \| 'update')[]` | `['full']` | Which Zod variant a hook is built on (`full` is the request-body shape; `create` / `update` reuse `createFields` / `updateFields`). At least one. |
| `relations` | `'flat' \| 'deep'` | `'flat'` | `flat`: scalar and enum fields only; `deep`: nested objects (to-one) and arrays (to-many), driven by the Zod `*Deep*` roles. |

- `include`: an unknown name (absent from every covered namespace) throws
  `UnknownIncludeEntityError` (`react_tanstack_unknown_include_entity`) so a typo cannot silently emit
  nothing. Namespace scoping stays the job of the generator entry's `namespaces`.
- Deep mode: cross-source relations degrade to the flat FK scalar with a `debug` log, as in
  [gen-angular relations.ts](../../../packages/gen-angular/src/render/relations.ts).

## Naming ([names.ts](../../../packages/gen-angular/src/names.ts) pattern)

Never namespace-prefixed. `Variant` token: `''` (full), `Create`, `Update`.

| Role | Identifier |
|---|---|
| hook | `use${Entity}${Variant}Form` (`useLoginDtoForm`) |
| options type | `Use${Entity}${Variant}FormOptions` |
| form API type | `${Entity}${Variant}FormApi` |
| default values fn | `default${Entity}${Variant}FormValues` |
| runtime helper | `useZodForm`, `ZodFormApi<T>` (from `form.runtime`) |

Modules: `${ns}/react-tanstack/${Entity}.form`, `${ns}/react-tanstack/form.runtime`,
`${ns}/react-tanstack` (barrel). The family (`Deep`) does not appear in identifiers: one generator entry
runs one `relations` mode.

## Emitted code

`form.runtime.ts` (once per namespace with at least one emitted entity) centralises every
`@tanstack/react-form` call so an upstream API shift is a single-file update:

```ts
import { revalidateLogic, useForm } from '@tanstack/react-form';
import type { ReactFormExtendedApi, StandardSchemaV1 } from '@tanstack/react-form';

export type ZodFormApi<T> = ReactFormExtendedApi<T, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, StandardSchemaV1<T, unknown>, undefined, undefined, unknown>;

export interface ZodFormConfig<T> {
  defaultValues: T;
  schema: StandardSchemaV1<T, unknown>;
  validation?: { mode?: 'change' | 'blur' | 'submit'; modeAfterSubmission?: 'change' | 'blur' | 'submit' };
  onSubmit?: (props: { value: T; formApi: ZodFormApi<T> }) => void | Promise<void>;
  onSubmitInvalid?: (props: { value: T; formApi: ZodFormApi<T> }) => void;
}

export function useZodForm<T>(config: ZodFormConfig<T>): ZodFormApi<T> { /* useForm({ ..., validationLogic:
  revalidateLogic(config.validation), validators: { onDynamic: config.schema } }) */ }
```

The exact generic argument order of `ReactFormExtendedApi` (12 parameters) and the re-export of
`StandardSchemaV1` from `@tanstack/react-form` are taken from the docs and **must be confirmed by the
compile test** (see Testing); the fallback for the type is `@standard-schema/spec`.

`<Entity>.form.ts`, per emitted variant (imports sorted and split value/type by `ImportsRecorder`,
identical to `gen-angular`):

```ts
import { LoginDtoSchema } from 'api/zod/LoginDto.schema';             // module from the Zod artifact
import type { LoginDtoDto } from 'api/zod/LoginDto.schema';
import { useZodForm } from 'api/react-tanstack/form.runtime';
import type { StandardSchemaV1, ZodFormApi, ZodFormConfig } from 'api/react-tanstack/form.runtime';

export function defaultLoginDtoFormValues(init?: Partial<LoginDtoDto>): LoginDtoDto {
  return { email: init?.email ?? '', password: init?.password ?? '' };
}

export type LoginDtoFormApi = ZodFormApi<LoginDtoDto>;

export interface UseLoginDtoFormOptions
  extends Omit<ZodFormConfig<LoginDtoDto>, 'defaultValues' | 'schema'> {
  defaultValues?: Partial<LoginDtoDto>;
  /** Replaces the generated schema, e.g. a refined or extended one built at runtime. */
  schema?: StandardSchemaV1<LoginDtoDto, unknown>;
}

export function useLoginDtoForm(options: UseLoginDtoFormOptions = {}): LoginDtoFormApi {
  const { defaultValues, schema, ...rest } = options;
  return useZodForm<LoginDtoDto>({
    ...rest,
    defaultValues: defaultLoginDtoFormValues(defaultValues),
    schema: schema ?? LoginDtoSchema,
  });
}
```

Behaviour and consequences:

- **Values are the Zod-inferred DTO type** (like `gen-angular`), not the schema input. TanStack passes the
  input to `onSubmit`; the only input/output gap in `gen-zod` today is `z.coerce.date()`
  ([scalars.ts:56](../../../packages/gen-zod/src/render/scalars.ts)), whose form value stays a `Date`.
  Documented; no parse-on-submit is generated.
- **Call-site schema** (Ekoz F4): `schema` replaces the generated one. `StandardSchemaV1<Dto, unknown>`
  is covariant in the input, so `LoginDtoSchema.extend(...)` / `.refine(...)` (Zod 4) or the Zod 3
  equivalent is accepted. Standard Schema needs Zod `>= 3.24` in Zod 3 mode: documented in the README
  and docs, not enforced (the artifact only carries `zod: ^3`).
- **Validation timing**: `revalidateLogic` with `mode: 'submit'`, `modeAfterSubmission: 'change'`, both
  overridable through `validation`.
- **Server errors** are not generated. The returned instance already supports
  `form.setErrorMap({ onSubmit: { fields: { email: '...' } } })` and a form-level `onSubmitAsync`;
  the docs show the pattern. The option surface is intentionally closed to
  `defaultValues`, `schema`, `validation`, `onSubmit`, `onSubmitInvalid` in v1 (arbitrary `useForm`
  options would expose TanStack's 12-generic surface in the emitted `.d.ts`); the returned instance
  gives full access afterwards. This narrows the overview's "override other options" to that list.
- **Initial values** come from a new shared `@kurotako/ir` helper (below). Required `ref` / non-discriminated
  `union` fields have no synthesisable zero and are seeded `undefined` cast to the exact DTO field type
  (as [signal.ts:80](../../../packages/gen-angular/src/render/signal.ts) does); Zod flags them until filled.
- **Deep** (`relations: 'deep'`): the values type is the Zod `*Deep*` type; a to-one relation's default
  is built by the target entity's own `default…FormValues` (imported as a value from its `.form`
  module), a to-many relation defaults to `[]`. TanStack addresses nested paths natively
  (`'author.name'`, `'tags[0].name'`), so no runtime helper is needed.
- **Cycles**: types come from the Zod DTOs, so `ctx.cycles` is only used for defaults: a recursive
  deep relation would loop in `default…FormValues`, so a to-one relation whose target takes part in a
  `ref` cycle (`ctx.cycles`, keyed `${namespace}.${name}`) is degraded to the flat scalar with a
  `debug` log.

## Shared initial-value helper (`@kurotako/ir`)

- New pure export next to `defaultValueExpr`: `formInitExpr(field, enumZero?)`, moved from `gen-angular`'s
  `zeroValue` + `initExpr` minus the Angular-specific `ref` / `union` `null` override
  ([controls.ts:166](../../../packages/gen-angular/src/render/controls.ts)). It returns the literal
  default, `[]` for a list / array, `null` for a nullable field, else the type zero (`''`, `0`, `false`,
  `0n`, `new Date(0)`, `{}`, first enum member); `ref` / `union` yield `undefined`.
- `gen-angular` imports it and keeps its own `ref` / `union` `null` seed on top; its existing tests
  (`controls.test.ts`, generator golden tests) must pass unchanged, which proves no drift.
- Tests: `ir/src/helpers.test.ts` (one case per branch, moved from `controls.test.ts`).
- Changesets: `@kurotako/ir` minor, `@kurotako/gen-angular` patch (internal refactor, no output change).

## Zod artifact reader

`zod-artifact.ts` mirrors `gen-angular`'s reader, with the dependency read from
`ctx.dependencies[options.zod]` (missing => `MissingZodDependencyError`,
`react_tanstack_missing_zod_dependency`, message names the option). Roles consumed:
`schema`/`type`, `createSchema`/`createType`, `updateSchema`/`updateType` and, in deep mode,
`deepSchema`/`deepType`, `createDeepSchema`/`createDeepType`, `updateDeepSchema`/`updateDeepType`.
Absent role => `MissingZodSymbolError` (same wording as `gen-angular`).

## Artifact

`buildArtifact`: `entities['<ns>.<Entity>'] = { module: '<ns>/react-tanstack/<Entity>.form', symbols }`
with roles `hook`, `options`, `api`, `defaultValues` for `full` and `createHook`, `createOptions`, … for
the other variants, restricted to included entities and selected variants.
`peerDependencies: { '@tanstack/react-form': <range> }` (the Zod artifact already carries `zod`); the
floor is pinned at implementation as the lowest release exporting `revalidateLogic`, the `onDynamic`
validator and `StandardSchemaV1` (`react` is covered by TanStack's own peer). `extra`:
`{ variants, relations, zod, zodVersion, perNamespace: { runtimeModule, barrelModule } }`.

## Determinism and output rules

Pure and synchronous like `gen-angular`: same IR + Zod artifact + options => deep-equal `GenOutput`.
Entities iterated in IR order; import lines sorted; one trailing newline. Empty namespace (no
included entity) emits only a valid empty `index.ts` and no runtime file. Root barrel collisions are
handled by core's synthesized barrel (`use…Form` names cannot collide with Zod / Angular exports).

## Testing

Per the project rule, every implementation ships with tests.

- Unit (vitest, `src/**/*.test.ts`): `options`, `names`, `zod-artifact`, `artifact`, `emit/barrel`,
  `render/*`, `generator` (golden strings for flat / deep, each variant, `include`, renamed `zod`,
  cross-source degrade, cycle degrade, determinism run twice).
- Compile test (`emit/*.compile.test.ts`, pattern of `gen-angular`'s `runtime.compile.test.ts`): run
  `zodGenerator` + `reactTanstackGenerator` on a fixture IR, write the output to a temp dir with the
  `${ns}/*` path alias and typecheck it with `tsc` against the **real** `@tanstack/react-form`, `react`
  and `zod` (devDependencies; exact versions pinned at implementation from the registry). This pins the
  12-generic `ZodFormApi` and the call-site schema assignability (`extend` / `refine`).
- Behaviour test: `@testing-library/react` `renderHook` (jsdom) on a compiled fixture: invalid submit
  surfaces the Zod issue on the matching field, a call-site refined schema replaces the generated one,
  validation runs on submit first and on change afterwards, `setErrorMap` server errors appear on a field.
- Config: tests listed in "Config and core change". Docs: `apps/docs` build passes.

## Documentation and registration

- Package `README.md`; `apps/docs`: `reference/catalog.md` entry (name `react-tanstack`, depends on the
  Zod entry, options table), a React quickstart under `getting-started/`, mentions in
  `concepts/dependency-graph.md`, `concepts/parsers-and-generators.md`, `reference/tako-config.md`,
  `intro.md`, `installation.md`; TypeDoc picks the package up through the docs config (verify entry
  points at implementation).
- Repo docs: `docs/README.md`, `docs/vision.md`, `docs/architecture.md` (generator list and
  the `dependsOn` contract note), root `README.md`, `AGENTS.md` work order.
- Example: `examples/openapi-react-tanstack` (OpenAPI source, Vite + React), following the existing
  `nestjs11-openapi-angular22-*` examples.
- Changesets: new package `@kurotako/gen-react-tanstack` (minor, first publish is manual per the release
  pipeline notes), `@kurotako/config` minor, `@kurotako/ir` minor, `@kurotako/gen-angular` patch.

## Ekoz wiring (informative, lives in the Ekoz repo)

```ts
generators: [
  { use: zodGenerator, namespaces: ['db'] },
  { use: zodApiGenerator, namespaces: ['api'] },          // rewrites paths AND artifact modules
  { use: reactTanstackGenerator, namespaces: ['api'],
    options: { zod: 'zod-api', include: ['LoginDto', 'RegisterDto'] } },
],
outputs: [{ dir: './apps/client-web/src/generated', generators: ['zod-api', 'react-tanstack'] }],
```

The Ekoz `auth` technical design still cites the former name `gen-react`; it must be updated there.

## Open points deferred

- Server-error mapping helper: left to the consumer (docs only).
- Arbitrary `useForm` option passthrough: revisit once the generic surface is measured on real usage.
- Per-instance output segment and implicit dependencies:
  [implicit-generator-dependencies](../implicit-generator-dependencies/overview.md).

## Implementation task breakdown

- [#196 — ir: extract the shared form initial-value helper from gen-angular](https://github.com/marmotz/kurotako/issues/196)
- [#197 — config: allow dependsOn to be computed from the generator options](https://github.com/marmotz/kurotako/issues/197)
- [#198 — gen-react-tanstack: package scaffold, options and Zod dependency wiring](https://github.com/marmotz/kurotako/issues/198) (depends on #197)
- [#199 — gen-react-tanstack: emit the runtime helper and flat entity hooks](https://github.com/marmotz/kurotako/issues/199) (depends on #196, #198)
- [#200 — gen-react-tanstack: relations 'deep' mode](https://github.com/marmotz/kurotako/issues/200) (depends on #199)
- [#201 — gen-react-tanstack: documentation site and repo docs](https://github.com/marmotz/kurotako/issues/201) (depends on #200)
- [#202 — examples: OpenAPI + React + TanStack Form example](https://github.com/marmotz/kurotako/issues/202) (depends on #200)
