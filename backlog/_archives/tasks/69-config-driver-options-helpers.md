# backend — @kurotako/config: declaration helpers + entry option types + loader normalisation

**Status**: done **Type**: backend **Issue**: [#69](https://github.com/marmotz/kurotako/issues/69)

Reference: [../features/driver-options-ergonomics/technical.md §3](../features/driver-options-ergonomics/technical.md#3-kurotakoconfig-changes),
[§2](../features/driver-options-ergonomics/technical.md#2-decisions-from-overviewmd-refined-here).

## Constat vérifié

- The driver contract types `optionsSchema?: v.GenericSchema<unknown, O>`
  ([`packages/config/src/types.ts:28-30`](../../../packages/config/src/types.ts)); only the Output param `O` is carried.
  Confirmed in TS 5.9.3: from an *annotated*
  `const x: TakoGenerator<ZodGeneratorOptions> = {…}`, `v.InferInput<typeof
  x.optionsSchema>` collapses to `unknown` — the same object with `satisfies`
  keeps the real input shape. Hence helpers, not a `OptionsOf`-only patch.
- `OptionsOf<D>` ([`types.ts:52-56`](../../../packages/config/src/types.ts))
  requires `optionsSchema` as **non-optional** → collapses to `undefined` for every annotated driver → `SourceEntry`/
  `GeneratorEntry` type `options?: undefined`
  (the `TS2322` in the overview).
- `parseDriverOptions` ([`load.ts:197-233`](../../../packages/config/src/load.ts))
  calls `v.safeParse(schema, options)` with `options === undefined` when the key is omitted; `v.object(...)` /
  `v.strictObject(...)` reject `undefined` →
  `driver_options_invalid`.
- Helper design proven in a throwaway TS 5.9.3 fixture (see technical.md §3.2):
  a `defineParser<const S extends v.GenericSchema<unknown, unknown> | undefined>`
  returning `typeof driver` keeps the literal schema, types `parse` against
  `v.InferOutput<S>`, and lets a downstream type read `v.InferInput<S>` with unknown-key / wrong-type rejection.
- `@kurotako/config` does **not** depend on `@kurotako/parser-prisma` /
  `@kurotako/gen-zod` (they depend on it) — this task uses local fixtures only.

## À faire

1. `packages/config/src/types.ts`:
  - Add `type AnyOptionsSchema = v.GenericSchema<unknown, unknown>` (internal).
  - Add and export `DriverOptions<S>` = `S extends AnyOptionsSchema ? v.InferOutput<S> : void`.
  - Add and export `EntryOptions<S>` = `S extends AnyOptionsSchema ? v.InferInput<S> : never`.
  - Add `SchemaOf<D>` = `D extends { optionsSchema?: infer S } ? (S extends AnyOptionsSchema ? S : never) : never`.
  - Add `OptionsMember<D>` per technical.md §3.1: `{ options?: never }` when
    `[SchemaOf<D>] extends [never]`; `{ options?: EntryOptions<…> }` when
    `[undefined] extends [EntryOptions<…>]` or `Record<string, never> extends EntryOptions<…>`; else
    `{ options: EntryOptions<…> }`.
  - **Remove** `OptionsOf`.
  - `SourceEntry<D>` = `{ use: D } & OptionsMember<D>`;
    `GeneratorEntry<D>` = `{ use: D; namespaces?: string[] } & OptionsMember<D>`.
  - Keep the `TakoParser<O>` / `TakoGenerator<O>` interfaces and
    `AnySourceEntry` / `AnyGeneratorEntry` unchanged.
2. `packages/config/src/define-driver.ts` (new) — `defineParser` and
   `defineGenerator` exactly as technical.md §3.2, each
   `<const S extends v.GenericSchema<unknown, unknown> | undefined = undefined>`, body `return driver`, return type
   `typeof driver`. `parse` / `watchPaths` /
   `generate` params typed `DriverOptions<S>`.
3. `packages/config/src/load.ts` — `parseDriverOptions`: when `schema` is set,
   `const input = options === undefined ? {} : options;` then
   `v.safeParse(schema, input)`. Update the function doc comment to state the
   "every optionsSchema is an object schema" assumption. Leave the no-schema branch untouched.
4. `packages/config/src/index.ts` — export `defineParser`, `defineGenerator`
   (from `./define-driver.js`) and the types `DriverOptions`, `EntryOptions`.
   `export type * from './types.js'` already covers `SourceEntry` / `GeneratorEntry`.
5. `packages/config/src/define.test-d.ts` — rewrite fixtures with the helpers:
  - `withOptions` via `defineParser` with `optionsSchema: v.strictObject({ schema:
     v.optional(v.string(), './s'), version: v.optional(v.picklist([7, 8])) })`
    (a defaulted + an optional field ⇒ `options` optional at the entry).
  - a `requiredOptions` parser via `defineParser` with
    `optionsSchema: v.object({ host: v.string() })` ⇒ `options` **required**:
    `defineConfig({ sources: { pg: { use: requiredOptions } }, … })` is
    `@ts-expect-error`, and supplying `{ host: 'x' }` compiles.
  - `noOptions` generator via `defineGenerator` (no `optionsSchema`) ⇒
    `{ use: noOptions, options: {} }` is `@ts-expect-error`; `{ use: noOptions }` ok.
  - all-default generator via `defineGenerator` with
    `optionsSchema: v.object({ n: v.optional(v.number(), 1) })` ⇒ `{ use: gen }`
    compiles (no `options`), `{ use: gen, options: { bad: 1 } }` is `@ts-expect-error`.
  - keep a wrong-type case (`options: { schema: 42 }` ⇒ `@ts-expect-error`).
  - drop the old `omittedParserOptions`-is-ok assertion (superseded by decision d).
6. `packages/config/src/load.test.ts` — add: a generator whose `optionsSchema`
   has every field defaulted, entry `{ use: gen }` with **no** `options` key →
   `loadConfig` succeeds and `config.generators.<name>.options` deep-equals the defaults. Existing "curries the parsed
   value" / "rejects bad options" / no-schema cases stay green.
7. `packages/config/src/template.test.ts` — extend the runtime test so the filled template's generator (all-default
   `optionsSchema`, no `options`)
   resolves to its defaults.
8. `bun run typecheck` (`tsc -b` type-checks `*.test-d.ts`), `bun run test`,
   `bun run build` green for `@kurotako/config`. Re-run `@kurotako/cli` /
   `@kurotako/parser-prisma` / `@kurotako/gen-zod` typecheck to confirm the
   `OptionsOf` removal + `SourceEntry`/`GeneratorEntry` change do not break them before task B migrates the drivers
   (annotated drivers still satisfy the structural `TakoParser` / `TakoGenerator`; `defineConfig` is not yet used with
   them anywhere outside fixtures).

## Dépendances

Aucune.
