# TypeScript generator (`@kurotako/gen-typescript`) — technical design

Design for `@kurotako/gen-typescript`. Product decisions come from [overview.md](overview.md);
the generator role and the DAG/artifact model live in
[`docs/architecture.md`](../../../docs/architecture.md). This document turns the overview
into a concrete package and an IR -> TypeScript source-text mapping.

This generator is the **pure-types sibling of `gen-zod`**. Its
[technical design](../../_archives/features/generator-zod/technical.md) is the reference
for every shared rule (naming matrix, variant derivation, relation families, filter
shapes, determinism); this document only records what differs because the target is plain
`type` declarations with no runtime.

## Starting point

- **No code exists.** Unlike `gen-zod` (which had a bootstrap placeholder from
  `monorepo-bootstrap`), `packages/gen-typescript/` is created from scratch by this
  feature. `packages/` currently holds `cli`, `config`, `core`, `gen-angular`, `gen-zod`,
  `ir`, `kurotako`, `parser-prisma`.
- Toolchain unchanged: Bun workspaces, `tsc -b` project references, tsup dual ESM+CJS
  (`tsup.config.base.ts` `basePreset`), vitest (root `vitest.config.ts` auto-discovers
  `packages/*/vitest.config.ts`), Biome. Node >= 24, **no `Bun.*` API**. The generator
  produces **strings only**; core's `Writer` owns all I/O.
- Upstream contracts already implemented and read **only** through their public surface:
  - [`@kurotako/ir`](../../_archives/features/ir-model/technical.md) — `IR` / `SourceIR` /
    `Entity` / `Field` / `FieldType` / `ScalarType` / `Constraints` / `DefaultValue` /
    `Relation` / `EnumDef` types, the `JsonValue` type (`packages/ir/src/schemas.ts:15`),
    and the pure helpers in `packages/ir/src/helpers.ts`:
    `iterEntities`, `resolveEnum`, `isCrossSource`, `primaryKeyFields`, and the
    **shared-decision** helpers `createFields`, `isCreateOptional`, `updateFields`,
    `isDbAssigned`, and **`scalarTsType`** — the mandated scalar -> TS-type mapping every
    generator's typed output must agree on.
  - [`@kurotako/core`](../../_archives/features/core-pipeline/technical.md) — `Generator`,
    `GenerateContext` (`{ ir, dependencies, logger }`, `ir` already namespace-filtered),
    `GenOutput` (`{ files: VirtualFile[]; artifact: GeneratorArtifact }`), and the fixed
    `GeneratorArtifact` / `EntitySymbols` shape (`packages/core/src/types.ts`). A generator
    owns the `<namespace>/<generatorName>/` prefix on every `VirtualFile.path`; core
    synthesizes `<namespace>/index.ts`.
  - [`@kurotako/config`](../../_archives/features/config-system/technical.md) —
    `defineGenerator({ name, optionsSchema?, dependsOn?, generate(ctx, options) })`
    (`packages/config/src/define-driver.ts`); runtime identity, curries `options` away.
- Downstream: **nothing consumes this generator in v1** (decided: standalone). `gen-zod`
  and `gen-angular` keep their own type layer. The artifact is still populated in full so
  the later "shared type layer" evolution needs no producer change.

## Package shape

Mirrors `gen-zod` one-for-one (single entry point, mode-B friendly):

```
packages/gen-typescript/
  package.json
  tsconfig.json
  tsup.config.ts            # export { basePreset as default } from '../../tsup.config.base'
  vitest.config.ts          # test.name 'gen-typescript', include src/**/*.test.ts
  src/
    index.ts               # barrel: typescriptGenerator + public types (TypeScriptArtifactExtra)
    generator.ts           # typescriptGenerator: defineGenerator({ name: 'typescript', generate })
    errors.ts              # TypeScriptGenError base + TypeScriptEnumCollisionError
    names.ts               # deterministic identifier + module-specifier helpers
    render/
      scalars.ts           # FieldType -> TS type string (wraps @kurotako/ir scalarTsType)
      jsdoc.ts             # Field -> JSDoc block (doc text + constraint tags + unknown hint)
      field.ts             # Field -> `name?: T | null` / `name: T[]` member line
      variants.ts          # per-entity field-set derivation (delegates to ir helpers)
      relations.ts         # flat (nothing) vs deep (nested named type) relation members
    emit/
      entity.ts            # one entity -> "<ns>/typescript/<Entity>.type.ts"
      enums.ts             # all enums of a source -> "<ns>/typescript/enums.ts"
      filters.ts           # shared Where operator interfaces -> "<ns>/typescript/filters.ts"
      scalars.ts           # "<ns>/typescript/scalars.ts" — the JsonValue helper type
      barrel.ts            # "<ns>/typescript/index.ts" re-export barrel
    artifact.ts            # assemble GeneratorArtifact (entities matrix + TypeScriptArtifactExtra)
    *.test.ts
```

### Dependencies (`package.json`, mirrors `gen-zod`)

| Dep | Kind | Why |
|---|---|---|
| `@kurotako/ir` | `dependencies` (`workspace:^`) | IR types + traversal/decision helpers, used at runtime while rendering |
| `@kurotako/core` | `peerDependencies` + `devDependencies` (`workspace:^`) | driver/artifact **types** only |
| `@kurotako/config` | `peerDependencies` + `devDependencies` (`workspace:^`) | `defineGenerator` (identity fn) |

- **No `valibot`.** v1 has **no options** (decided): `defineGenerator` is called without
  `optionsSchema`. `generate(ctx)` ignores its second argument.
- **No `typescript` runtime dep, no peer dependency of any kind for the generated code** —
  the emitted `type` declarations import nothing external (`Date`, `Uint8Array` are
  global). `GeneratorArtifact.peerDependencies` is omitted / empty.
- `"sideEffects": false`. `tsconfig.json` `references`: `../ir`, `../core`, `../config`.
- `package.json` shape (name, `exports`, `files: ["dist", "CHANGELOG.md", "LICENSE"]`,
  `publishConfig.access: "public"`, `engines.node >= 24`) copied verbatim from
  `packages/gen-zod/package.json` with the name/description/keywords/`repository.directory`
  swapped.

## Public contract (`generator.ts`)

```ts
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput } from '@kurotako/core';

export const typescriptGenerator = defineGenerator({
  name: 'typescript',
  generate(ctx: GenerateContext): GenOutput {
    // pure, synchronous: iterate ctx.ir.sources, render text, assemble the artifact
  },
});
```

- `name: 'typescript'` — short name / config key / sub-tree segment `<ns>/typescript/`
  (decided; consistent with `zod` / `angular`).
- No `dependsOn` / `optionalDependsOn` — reads nothing but the IR.
- `generate` is **synchronous and pure**: same IR -> deep-equal `GenOutput` (drift-guard).

## Naming (`names.ts`) — reuse the `gen-zod` matrix, `Dto` half only

Identical stem rules to
[`gen-zod` §Naming](../../_archives/features/generator-zod/technical.md#naming-namests--deterministic-never-namespace-prefixed)
(`packages/gen-zod/src/names.ts`), keeping the `Dto` type identifiers and dropping every
`Schema` identifier:

| Variant | flat family | deep family |
|---|---|---|
| full | `UserDto` | `UserDeepDto` |
| create | `UserCreateDto` | `UserCreateDeepDto` |
| update | `UserUpdateDto` | `UserUpdateDeepDto` |
| where | `UserWhereDto` | `UserWhereDeepDto` |
| select | `UserSelectDto` | `UserSelectDeepDto` |

- Pattern `${Entity}${Variant}${Family}Dto`, `Variant ∈ {'', Create, Update, Where,
  Select}`, `Family ∈ {'', Deep}`. `VARIANTS` / `FAMILIES` / `VARIANT_TOKEN` /
  `FAMILY_TOKEN` are copied from `gen-zod`'s `names.ts` (small, stable, no shared package
  for them in v1 — same call made for `dialect`-style seams in `gen-zod`).
- Enums (aligned on `gen-zod`, minus the `z.enum` line): resolved `EnumDef` named `Role`
  -> `export const Role = ['ADMIN', 'USER'] as const;` +
  `export type Role = (typeof Role)[number];` (const value and type share the name —
  legal, distinct TS namespaces). Enum refs resolved with `resolveEnum` (entity-local
  before source-level).
- Two **distinct** `EnumDef`s reachable in one source under the same name ->
  `TypeScriptEnumCollisionError` (code `typescript_enum_collision`), naming both origins.
  Same-name identical defs de-duplicated. Straight port of `gen-zod`'s `emit/enums.ts`
  `collectEnums` + `ZodEnumCollisionError`.
- **Module specifiers** (POSIX, extension-less): `<ns>/typescript/<Entity>.type`,
  `<ns>/typescript/enums`, `<ns>/typescript/filters`, `<ns>/typescript/scalars`,
  `<ns>/typescript` (barrel). Cross-file imports are `import type { … } from '…'`
  (`verbatimModuleSyntax` is on).

## File layout — one file per entity + shared files

Per namespace `<ns>`, under the output root:

```
<ns>/typescript/
  scalars.ts          # export type JsonValue = … (recursive) — emitted only when some field is `json`
  enums.ts            # every source-level + entity-local EnumDef (const array + type)
  filters.ts          # shared Where operator interfaces — emitted when the source has >= 1 entity
  <Entity>.type.ts    # one per entity: 5 variants x 2 families; type-only imports from ./enums, ./filters, ./scalars, sibling ./<Other>.type
  index.ts            # barrel: export * / export type * from every file above
```

- `scalars.ts` / `filters.ts` are a **refinement of the overview** (which listed only
  `<Entity>.type.ts` + `enums.ts` + `index.ts`), exactly as `gen-zod`'s technical design
  added `filters.ts`. `filters.ts` is emitted whenever the source has >= 1 entity (every
  entity gets a `Where` variant); `scalars.ts` only when at least one field maps to
  `JsonValue`. `enums.ts` and `index.ts` are always emitted (an empty source still yields
  a valid `index.ts`).
- One file per entity (not per variant) keeps the import graph flat. Unlike `gen-zod`
  there is **no `z.lazy` and no split base type**: mutually recursive `type` aliases
  across sibling entity files are legal in TypeScript and emit a clean `.d.ts` (this is
  precisely the cycle-safety `gen-zod`'s `emit/entity.ts` header comment contrasts against
  const initializers). The deep family therefore just names the target's `Dto` directly.
- File name is `<Entity>.type.ts` (matches the overview; `gen-zod` uses
  `<Entity>.schema.ts`).

## IR -> TypeScript source-text mapping

Text assembly. Entities iterated in `@kurotako/ir` key order
(`Object.values(source.entities)`, as `gen-zod` does), fields in declaration order, enums
sorted by name, imports sorted by specifier.

### Field type (`render/scalars.ts`)

The non-nullable, non-list TS type of a field is
**`scalarTsType(field.type)`** (`packages/ir/src/helpers.ts`) verbatim — no local
re-encoding (mandated by the helper's own doc comment and
[`ir-model` §Shared-decision helpers](../../_archives/features/ir-model/technical.md#shared-decision-helpers-helpersts)):

| `FieldType` | TS type |
|---|---|
| `scalar` `string` / `uuid` / `decimal` | `string` |
| `scalar` `boolean` | `boolean` |
| `scalar` `int` / `float` | `number` |
| `scalar` `bigint` | `bigint` |
| `scalar` `date` / `datetime` | `Date` |
| `scalar` `bytes` | `Uint8Array` |
| `scalar` `json` | `JsonValue` (import `type` from `./scalars`) |
| `enum` | the resolved enum type name (import `type` from `./enums`) |
| `unknown` | `unknown` |

- `render/scalars.ts` wraps `scalarTsType` only to (a) record when `JsonValue` / an enum
  name is used (drives the import block and `scalars.ts` emission) and (b) map an enum ref
  through `resolveEnum` first.
- `JsonValue` helper emitted into `scalars.ts` (copied from `packages/ir/src/schemas.ts`
  `JsonValue`, the type only):
  ```ts
  export type JsonValue =
    | null | boolean | number | string
    | JsonValue[] | { [key: string]: JsonValue };
  ```

### Member assembly (`render/field.ts`)

For a `Field` in a given variant, emit one member line `  <jsdoc>\n  <name><opt>: <type>;`:

1. `type` = field type (above).
2. `field.list` -> `<type>[]` (parenthesised for unions: `(A | B)[]`).
3. `field.nullable` -> `<type> | null`.
4. optionality is **variant-driven** (next section) -> `?` on the property key
   (`name?: T`), never `| undefined` in the value.

### JSDoc (`render/jsdoc.ts`) — decided: doc + constraints + unknown hint

A `/** … */` block precedes the member when it has any content, in this fixed order:

1. `field.doc` (verbatim prose lines), then a blank line if tags follow.
2. constraint tags from `field.constraints`, reusing `gen-zod`'s constraint vocabulary
   (`packages/gen-zod/src/render/constraints.ts`): `@min <n>`, `@max <n>`,
   `@minLength <n>`, `@maxLength <n>`, `@pattern <regex source>`, `@format <name>`
   (the closed `StringFormat` union), `@unique` (flag; `gen-zod` drops it from the schema,
   here it survives only as documentation).
3. for a `{ kind: 'unknown' }` field, `@see` line `unknown` or `unknown: <hint>`
   (mirrors `gen-zod`'s trailing `// unknown[: hint]` comment).

JSDoc is **documentation only** — it never changes the emitted type (decided in the
overview: no branded types).

### Variant field sets (`render/variants.ts`)

Delegates to the same `@kurotako/ir` shared-decision helpers `gen-zod`'s
`render/variants.ts` uses (`createFields`, `isCreateOptional`, `updateFields`), so the two
generators' payload shapes stay in lockstep by construction:

| Variant | Fields | Optionality |
|---|---|---|
| full | all scalar/enum fields | `field.optional` -> `?` |
| create | `createFields(entity)` | `isCreateOptional(field)` -> `?` |
| update | `updateFields(entity)`, whole object `Partial<…>` | every member `?` |
| where | all scalar/enum fields, each wrapped in its filter type, all `?`; plus `AND` / `OR` / `NOT` | every member `?` |
| select | all scalar/enum fields **and** relations, each `boolean` (flat) / `boolean \| <Target>SelectDeepDto` (deep), all `?` | every member `?` |

- `create` literal defaults: `gen-zod` emits `.default(v)`; pure types have no equivalent,
  so a literal default only makes the field `?` (already covered by `isCreateOptional`).
  A `{ kind: 'value' }` default may be surfaced as a `@default <json>` JSDoc tag
  (documentation only).

### Where operator types (`emit/filters.ts`) — port of `gen-zod`'s `filters.ts`

Shared per namespace in `filters.ts`, one `interface` per scalar class actually used by a
field (`packages/gen-zod/src/emit/filters.ts` `filterClass` + `SCALAR_FILTER_ORDER`):

```ts
export interface StringFilter {
  equals?: string; not?: string;
  in?: string[]; notIn?: string[];
  lt?: string; lte?: string; gt?: string; gte?: string;
  contains?: string; startsWith?: string; endsWith?: string;
}
// IntFilter / FloatFilter / BigIntFilter / DateTimeFilter: equals/not/in/notIn/lt/lte/gt/gte
// BoolFilter: equals? / not?
// Enum<Name>Filter (imports the enum type): equals? / not? / in? / notIn?
```

- Base TS type per class from `scalarTsType` (`StringFilter` -> `string`, `IntFilter` ->
  `number`, `DateTimeFilter` -> `Date`, `BigIntFilter` -> `bigint`, …).
- Each entity `Where` type: `{ <field>?: <Filter>; …; AND?: <Dto> | <Dto>[]; OR?: …;
  NOT?: … }`.
- Relations in `Where`: flat family filters the FK scalar field only (already an ordinary
  `Field`). Deep family adds, for a to-one relation `rel?: <Target>WhereDeepDto`; for a
  to-many `rel?: { some?: X; every?: X; none?: X }`.
- `json` / `unknown` fields have no filter class (`filterClass` returns `null`) — omitted
  from `Where`, same as `gen-zod`.

### Relations (`render/relations.ts`) — two families

| Family | to-one | to-many |
|---|---|---|
| flat | nothing — the FK scalar `Field`(s) are already members | nothing |
| deep | `rel: <Target><Variant>DeepDto` (`?` if `rel.optional`) | `rel?: <Target><Variant>DeepDto[]` |

- **Cross-source relations** (`isCrossSource(fromNs, rel)` true): the deep family cannot
  deterministically import across namespace directories in v1 -> **degrade to the flat
  representation** (FK id only) and `logger.debug(...)`. Identical policy and message
  shape to `packages/gen-zod/src/render/relations.ts`.
- No `z.lazy` wrapper; the nested type is named directly.

## Artifact (`artifact.ts`) — full matrix + extra (decided)

Port of `packages/gen-zod/src/artifact.ts`, keeping only the `*Type` roles:

```ts
export interface TypeScriptArtifactExtra {
  families: ['flat', 'deep'];
  variants: ['full', 'create', 'update', 'where', 'select'];
  perNamespace: Record<string, {
    barrelModule: string;
    filtersModule: string;
    scalarsModule: string;
    enums: Record<string, { constName: string; typeName: string; module: string }>;
  }>;
}
```

- `entities[`${ns}.${entity}`] = { module: `${ns}/typescript/${entity}.type`, symbols }`
  where `symbols` is `role -> identifier` for every variant/family pair, roles
  `type`, `createType`, `updateType`, `whereType`, `selectType`, `deepType`,
  `createDeepType`, `updateDeepType`, `whereDeepType`, `selectDeepType` (the `*Type` half
  of `gen-zod`'s `entitySymbols` matrix).
- `peerDependencies` omitted (empty). `extra` is `TypeScriptArtifactExtra`, re-exported
  from the package barrel for a future consumer to cast to.

## Determinism (drift-guard)

Same guarantees as `gen-zod`
([§Determinism](../../_archives/features/generator-zod/technical.md#determinism)): `ctx.ir`
already namespace-filtered and key-ordered by core; entity/field order preserved and never
sorted; enums sorted by name; import lines sorted by specifier; no timestamps, absolute
paths or `Date.now()`; `generate` synchronous, reads nothing outside `ctx`. The
"generated, do not edit" banner is `output-modes`' concern, not added here.

## Alternatives considered

- **`interface` for the full shape, `type` for derived variants.** Rejected in the
  overview — `type` everywhere derives `Partial` / `Omit` variants and the flat/deep
  families uniformly, is union-ready for
  [ir-union-type](../ir-union-type/overview.md), and declaration merging is meaningless
  for regenerated code.
- **`json -> unknown`** (the overview's first draft). Rejected — `@kurotako/ir`'s
  `scalarTsType` is the single mandated scalar mapping and returns `JsonValue`; diverging
  would re-encode a rule the pipeline reads from one place. Cost is one small emitted
  helper type.
- **Constraints as branded types** (`type Email = string & { __brand }`). Rejected in the
  overview — viral at call sites, heavy for a "just the shape" target. JSDoc only.
- **This generator as a hard dependency of `gen-zod` / `gen-angular`** (shared type
  layer). Deferred — would freeze the exposed artifact now and force `gen-zod` to import
  cross-package types; standalone in v1, artifact populated for the later move.
- **`z.lazy`-style indirection / split base type for the deep family.** Not needed —
  mutually recursive `type` aliases emit a clean `.d.ts`; the whole reason `gen-zod` needs
  the split is that const initializers can't be mutually inferred.
- **Trim the v1 matrix** (flat-only, or drop Where/Select). Rejected — parity with
  `gen-zod`, same decision the user made there.
- **A shared `@kurotako/gen-common` for `VARIANTS` / naming helpers.** Out of scope —
  `gen-zod` already duplicates such small seams; a common package is its own feature.

## Accepted limitations (v1)

- **No options** — scalar mapping, naming and layout are all fixed. An override map is a
  later evolution.
- **`Constraints.unique` and literal defaults** surface only as JSDoc, never in the type.
- **Cross-source relations degrade to FK-id** even in the deep family.
- **`Select` is `boolean` / nested-boolean only** — no `{ select, include, where }`
  nesting, no field arguments (same as `gen-zod`).
- **No `orderBy` / pagination / aggregate types.**
- Nothing consumes the artifact yet; the `symbols` matrix is unverified by a real
  consumer until the shared-layer evolution lands.

## Consequences verified against the repo

- **New package.** `tsconfig.json` (root solution file) gains
  `{ "path": "packages/gen-typescript" }`. `bun`'s `workspaces: ["packages/*", "apps/*"]`
  and the root `vitest.config.ts` (`projects: ['packages/*/vitest.config.ts']`) pick it up
  with no edit. `scripts/release-publish.sh` iterates `packages/*/package.json`, so it is
  included automatically — but per the release runbook the **first** publish of any new
  package is done manually/locally (npm OIDC trusted-publishing needs the package to exist
  first). A `.changeset/*.md` entry (`@kurotako/gen-typescript` minor/`0.1.0`) is required.
- **`README.md`** lists `@kurotako/gen-zod` / `@kurotako/gen-angular` in the install line
  and imports (`README.md:32`, `:45`); add `@kurotako/gen-typescript` /
  `typescriptGenerator` when this lands (doc-only, not this phase).
- **`@kurotako/ir`** — first consumer of `scalarTsType` in a generator (only
  `gen-zod`/`gen-angular` used the create/update helpers so far); it also re-exercises the
  `JsonValue` type export. No IR change required — the mapping, the `StringFormat` closed
  union and the shared helpers already cover everything.
- **`@kurotako/core`** — `typescriptGenerator` matches `Generator` (`name`, no
  `dependsOn`, `generate(ctx)` after config currying); returns `{ files, artifact }` with
  `<ns>/typescript/`-prefixed POSIX paths and a `GeneratorArtifact` keyed
  `${ns}.${entity}`. No core change.
- **`@kurotako/config`** — `defineGenerator` called without `optionsSchema`; supported
  (the generic defaults to `undefined`, `packages/config/src/define-driver.ts`).
- **`gen-zod` / `gen-angular`** — untouched. `gen-angular`'s `dependsOn: ['zod']` and the
  DAG are unaffected (this generator has no edges).
- **`docs/architecture.md`** — the "one sub-tree per generator" and "identifiers never
  namespace-prefixed" rules already cover `<ns>/typescript/` and `UserDto`; reconcile the
  prose list of shipped generators when this lands (doc-only).

## Tests (vitest, colocated)

Fixture-driven: hand-built `IR` objects fed through `typescriptGenerator.generate`,
asserting emitted **source text** (targeted substring / `ts`-parse assertions, not brittle
full-file snapshots) and **artifact structure**.

- **scalars**: every `ScalarType` -> `scalarTsType` token; `json` field -> `JsonValue` +
  `import type … from './scalars'` + `scalars.ts` emitted; enum field -> enum type name +
  import from `./enums`; `unknown` -> `unknown`.
- **member assembly**: `list` -> `T[]` (`(A | B)[]` for unions); `nullable` -> `T | null`;
  `optional` -> `name?:` in `full`.
- **jsdoc**: `field.doc` rendered; `minLength`/`maxLength`/`min`/`max` -> `@minLength` etc;
  `regex` -> `@pattern`; `format: 'email'` -> `@format email`; `unique` -> `@unique`;
  `unknown` hint line; no JSDoc when the field has none.
- **variants**: `create` drops the `expr`-default primary key and marks
  `isCreateOptional` fields `?`; `update` is `Partial<…>` minus the primary key; `where`
  wraps each field in its filter type and adds `AND`/`OR`/`NOT`; `select` is
  all-boolean (flat) / boolean-or-nested (deep).
- **families**: flat entity file has no reference to any `*DeepDto`; deep file names
  sibling `<Target>*DeepDto` directly (no `z.lazy`); to-many -> `<Target>DeepDto[]`;
  two entities referencing each other -> both `.type.ts` files typecheck (`tsc --noEmit`
  on the fixture output).
- **filters.ts**: only the interfaces for scalar classes actually used are emitted;
  `Enum<Name>Filter` imports the enum type; `json`/`unknown` fields excluded.
- **enums.ts**: `const X = [...] as const` + `type X`; entity-local enum emitted;
  same-name distinct defs -> `TypeScriptEnumCollisionError`.
- **barrel**: `index.ts` re-exports every emitted file; empty source -> still an
  `index.ts`.
- **cross-source relation**: deep family degrades to FK id + `debug` log.
- **artifact**: `entities` keyed `${ns}.${entity}`, `module === '<ns>/typescript/<entity>.type'`,
  every `*Type` role present in `symbols`; `extra.families` / `extra.variants` /
  `extra.perNamespace` (barrel/filters/scalars modules + enums).
- **determinism**: same IR -> deep-equal `GenOutput` on a second call; entity/field order
  preserved; import lines sorted.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`
(label `feature:generator-typescript`).

1. [#118](https://github.com/marmotz/kurotako/issues/118)
   [118-ts-gen-scaffold](../../tasks/118-ts-gen-scaffold.md) — package skeleton
   (`package.json` / `tsconfig` / `tsup` / `vitest`, root `tsconfig` ref), `src/errors.ts`,
   `src/names.ts`, `src/generator.ts` skeleton, barrel. No feature dep.
2. [#119](https://github.com/marmotz/kurotako/issues/119)
   [119-ts-gen-scalars-jsdoc-field](../../tasks/119-ts-gen-scalars-jsdoc-field.md) —
   `render/scalars.ts` (wraps `scalarTsType`), `render/jsdoc.ts`, `render/field.ts`
   (member assembly), `emit/scalars.ts` (`JsonValue` helper) (dep: #118).
3. [#120](https://github.com/marmotz/kurotako/issues/120)
   [120-ts-gen-variants-relations](../../tasks/120-ts-gen-variants-relations.md) —
   `render/variants.ts` (delegates to the IR shared-decision helpers), `render/relations.ts`
   (flat vs deep, cross-source degrade) (dep: #119).
4. [#121](https://github.com/marmotz/kurotako/issues/121)
   [121-ts-gen-emit-enums-filters](../../tasks/121-ts-gen-emit-enums-filters.md) —
   `emit/enums.ts` (const array + type, collision guard), `emit/filters.ts` (Where
   operator interfaces) (dep: #118).
5. [#122](https://github.com/marmotz/kurotako/issues/122)
   [122-ts-gen-emit-entity-barrel](../../tasks/122-ts-gen-emit-entity-barrel.md) —
   `emit/entity.ts` (per-entity file, 5 × 2 matrix, sorted type-only imports),
   `emit/barrel.ts` (deps: #120, #121).
6. [#123](https://github.com/marmotz/kurotako/issues/123)
   [123-ts-gen-artifact-and-wiring](../../tasks/123-ts-gen-artifact-and-wiring.md) —
   `artifact.ts` (`GeneratorArtifact` + `TypeScriptArtifactExtra`), `generate()` wiring
   over `ctx.ir.sources`, changeset, README, end-to-end + determinism tests (dep: #122).
