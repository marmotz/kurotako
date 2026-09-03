# Driver options ergonomics — technical design

**Feature**: [`overview.md`](./overview.md)
**Touches**: `@kurotako/config`, `@kurotako/parser-prisma`, `@kurotako/gen-zod`,
`@kurotako/gen-angular` (future), `@kurotako/cli` (acceptance only).

## 1. Problem recap (verified against current code)

Three defects, all in the driver-`options` path:

- **(a) `OptionsOf` sees `unknown` for the option keys.** The driver contract
  ([`packages/config/src/types.ts:28-30`](../../../packages/config/src/types.ts))
  types `optionsSchema?: v.GenericSchema<unknown, O>` — only the **Output** type
  parameter `O` is carried. Drivers are declared with an *annotation*
  (`export const prismaParser: TakoParser<PrismaParserOptions> = { … }`,
  [`packages/parser-prisma/src/parser.ts:22`](../../../packages/parser-prisma/src/parser.ts);
  `packages/gen-zod/src/generator.ts:19`). The annotation widens the concrete
  `optionsSchema` to the interface type, which does **not** retain the schema's
  `InferInput`. Confirmed in TS 5.9.3: from
  `const x: TakoGenerator<ZodGeneratorOptions> = {…}`, `v.InferInput<typeof
  x.optionsSchema>` resolves to `unknown`; the same object declared with
  `satisfies` keeps the real input shape. `OptionsOf<D>`
  ([`types.ts:52-56`](../../../packages/config/src/types.ts)) additionally
  requires `optionsSchema` as a **non-optional** property, so for every
  annotated driver it collapses to `undefined` and `SourceEntry` /
  `GeneratorEntry` type `options?: undefined` — hence the `TS2322` in the
  overview.

- **(b) `load.ts` feeds `undefined` to a non-optional object schema.**
  [`parseDriverOptions`](../../../packages/config/src/load.ts) (`load.ts:197-233`)
  calls `v.safeParse(schema, entry.options)`; when `options` is omitted that is
  `v.safeParse(schema, undefined)`. `ZodGeneratorOptions = v.object({ … })`
  ([`packages/gen-zod/src/options.ts:14-16`](../../../packages/gen-zod/src/options.ts))
  and `PrismaParserOptions = v.strictObject({ … })`
  ([`packages/parser-prisma/src/options.ts:13-16`](../../../packages/parser-prisma/src/options.ts))
  reject `undefined`, producing `driver_options_invalid`
  ([`errors.ts:98`](../../../packages/config/src/errors.ts)).

- **(c) Entry type uses the schema Output, not Input.** Even once (a) is fixed,
  inferring from the Output makes fields with a Valibot default (`schema` in
  `PrismaParserOptions`) **required** in the config entry, so `options: {}`
  would not typecheck.

## 2. Decisions (from `overview.md`, refined here)

| # | Decision |
|---|----------|
| a | The driver contract gets **declaration helpers** `defineParser` / `defineGenerator` exported from `@kurotako/config`. They infer everything from the passed object (including the literal `optionsSchema` type). Driver packages drop the `: TakoParser<O>` / `: TakoGenerator<O>` annotation. |
| b | `parseDriverOptions` **normalises a missing `options` to `{}`** before `safeParse` when the driver declares an `optionsSchema`. No per-driver schema wrapping. |
| c | The config **entry** `options` is typed `v.InferInput<schema>`; the **driver body** keeps receiving `v.InferOutput<schema>` (defaults applied by `load.ts`). |
| d | `options` is **required at the type level** when `v.InferInput<schema>` has a required field (and `undefined` is not accepted); optional otherwise. |
| e | A driver with **no `optionsSchema`** ⇒ entry `options?: never` (passing any object is a type error). `load.ts` keeps accepting `undefined` on that path. |

### Why helpers rather than "fix `OptionsOf` only" (the `overview.md` open question)

Proven above: the annotation `: TakoParser<O>` structurally erases the schema's
`InferInput`. No change confined to `@kurotako/config` can recover it while
drivers keep that annotation — `OptionsOf` would only ever see `unknown`, so the
feature Goal ("autocomplete on the option keys, error on unknown keys") is
unreachable. `satisfies` would work but is a bare convention easy to get wrong
(and it does not constrain the `parse` / `generate` signature). A helper both
preserves the literal type **and** type-checks the driver body against the
schema Output. This supersedes the `overview.md` phrasing "fix in
`@kurotako/config`, drivers unchanged": the fix is in `@kurotako/config` (the
helper), and each driver changes one line (annotation → helper call).

## 3. `@kurotako/config` changes

### 3.1 `types.ts` — helper-facing types

```ts
import type * as v from 'valibot';

// biome-ignore lint/complexity/noBannedTypes: {} here means "any object incl. empty"
type AnyOptionsSchema = v.GenericSchema<unknown, unknown>;

/** Options the driver body receives: schema Output, or `void` when schemaless. */
export type DriverOptions<S> = S extends AnyOptionsSchema ? v.InferOutput<S> : void;

/** Options the config entry accepts: schema Input, or `never` when schemaless. */
export type EntryOptions<S> = S extends AnyOptionsSchema ? v.InferInput<S> : never;

/** The schema type carried by a helper-declared driver, or `never`. */
export type SchemaOf<D> = D extends { optionsSchema?: infer S }
  ? S extends AnyOptionsSchema
    ? S
    : never
  : never;

/** `{ options?: … }` | `{ options: … }` | `{ options?: never }` per decisions c/d/e. */
export type OptionsMember<D> = [SchemaOf<D>] extends [never]
  ? { options?: never }
  : [undefined] extends [EntryOptions<SchemaOf<D>>]
    ? { options?: EntryOptions<SchemaOf<D>> }
    : // biome-ignore lint/complexity/noBannedTypes: emptiness probe
      Record<string, never> extends EntryOptions<SchemaOf<D>>
      ? { options?: EntryOptions<SchemaOf<D>> }
      : { options: EntryOptions<SchemaOf<D>> };
```

`OptionsOf<D>` is **removed** (only `define.ts` / entry types used it).
`SourceEntry` / `GeneratorEntry` become:

```ts
export type SourceEntry<D = TakoParser<any>> = { use: D } & OptionsMember<D>;
export type GeneratorEntry<D = TakoGenerator<any>> = { use: D; namespaces?: string[] } & OptionsMember<D>;
```

The `TakoParser<O>` / `TakoGenerator<O>` **interfaces stay** — they are the
structural contract `load.ts` casts to and the shape the helpers validate
against. `AnySourceEntry` / `AnyGeneratorEntry` are unchanged (`options?: unknown`).

### 3.2 New `define-driver.ts` — the helpers

```ts
export function defineParser<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
>(driver: {
  name: string;
  optionsSchema?: S;
  parse(ctx: ParseContext, options: DriverOptions<S>): SourceIR | Promise<SourceIR>;
  watchPaths?(ctx: ParseContext, options: DriverOptions<S>): string[] | Promise<string[]>;
}): typeof driver {
  return driver;
}

export function defineGenerator<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
>(driver: {
  name: string;
  dependsOn?: string[];
  optionalDependsOn?: string[];
  optionsSchema?: S;
  generate(ctx: GenerateContext, options: DriverOptions<S>): GenOutput | Promise<GenOutput>;
}): typeof driver {
  return driver;
}
```

Verified in TS 5.9.3 (`scratchpad/probe2.ts`): the returned type keeps the
literal schema, `parse`/`generate` see `InferOutput` (`schema` required, default
applied), and a downstream `EntryOptions<SchemaOf<typeof prismaParser>>` yields
`{ schema?: string; version?: 7 | 8 }` with unknown-key and wrong-type
rejection; the schemaless helper call yields `optionsSchema: undefined` ⇒
`OptionsMember` = `{ options?: never }`.

Exports added to [`index.ts`](../../../packages/config/src/index.ts):
`defineParser`, `defineGenerator`, and the types `DriverOptions`, `EntryOptions`
(the rest stay internal). `export type * from './types.js'` already re-exports
the entry types.

### 3.3 `load.ts` — `parseDriverOptions` (fix b)

```ts
function parseDriverOptions(role, name, schema, options, namespace?) {
  if (schema) {
    // A driver whose every option has a default must load with no `options` key.
    const input = options === undefined ? {} : options;
    const result = v.safeParse(schema, input);
    if (!result.success) throw new DriverOptionsError(role, name, normalizeIssues(result.issues), namespace);
    return result.output;
  }
  // unchanged: no schema ⇒ `options` must be undefined or a plain object
  …
}
```

Assumption (documented in the function comment): every `optionsSchema` is an
object schema. A schema that legitimately rejects `{}` (a required option)
still throws `DriverOptionsError` — with decision (d) that case is already a
compile error for typed configs, and remains a clear runtime error for plain-JS
configs.

`schema.ts` (`TakoConfigSchema`) is unchanged — `options: v.optional(v.unknown())`
already covers every case structurally.

### 3.4 `define.ts`

No code change needed: it already threads `S[K]['use']` / `G[K]['use']` into
`SourceEntry` / `GeneratorEntry`, and `const` type parameters keep the driver
literal. The new `OptionsMember` intersection makes a missing-but-required
`options` an error on the offending entry (homomorphic mapped type preserved).

## 4. Driver package changes

### 4.1 `@kurotako/parser-prisma`

[`parser.ts`](../../../packages/parser-prisma/src/parser.ts): replace

```ts
export const prismaParser: TakoParser<PrismaParserOptions> = { … }
```

with

```ts
export const prismaParser = defineParser({
  name: 'prisma',
  optionsSchema: PrismaParserOptions,
  async parse(ctx, options) { … },   // options: v.InferOutput<typeof PrismaParserOptions>
  async watchPaths(ctx, options) { … },
});
```

Import `defineParser` from `@kurotako/config` (drop the `TakoParser` type
import). `PrismaParserOptions` the *type* alias stays `v.InferOutput<…>` (what
`parse` receives) — no change. `strictObject` already gives unknown-key
rejection, now surfaced at config-entry compile time.

### 4.2 `@kurotako/gen-zod`

[`generator.ts:19`](../../../packages/gen-zod/src/generator.ts): same swap
`TakoGenerator<ZodGeneratorOptions>` → `defineGenerator({ … })`. `zodVersion`
has a default ⇒ `EntryOptions` = `{ zodVersion?: 3 | 4 }` ⇒ entry `options`
optional ⇒ `{ use: zodGenerator }` in `CONFIG_TEMPLATE` typechecks and loads.

### 4.3 `@kurotako/gen-angular`

No generator object exists yet ([`index.ts`](../../../packages/gen-angular/src/index.ts)
is a version constant). Nothing to migrate; the helper is the documented way
when it lands.

## 5. `CONFIG_TEMPLATE`

[`template.ts`](../../../packages/config/src/template.ts) is left as-is (the
example lines are commented). The acceptance is: **uncommenting them verbatim**
must typecheck and run. A new compile fixture (§6) pins that.

## 6. Tests

| File | Change |
|------|--------|
| `packages/config/src/define.test-d.ts` | Switch `withOptions`/`noOptions` fixtures to `defineParser`/`defineGenerator`. Update `omittedParserOptions`: `withOptions` now has a **required** `schema`, so omitting `options` becomes `@ts-expect-error` (decision d). Add: all-default generator (`defineGenerator` with only defaulted options) accepts `{ use: gen }`; unknown option key rejected; `options` on a schemaless driver is `@ts-expect-error`. |
| `packages/config/src/template.test-d.ts` *(new)* | Import the real `prismaParser` / `zodGenerator`, paste the uncommented `CONFIG_TEMPLATE` body into a `defineConfig` call, assert it compiles. |
| `packages/config/src/load.test.ts` | Add: `{ use: <generator with all-default optionsSchema> }` and no `options` key → loads, `config.generators.x.options` deep-equals the defaults. Existing "curries the parsed value" / "rejects bad options" cases unaffected. |
| `packages/config/src/template.test.ts` | Existing runtime test still valid; add an assertion that a `zodGenerator`-style all-default driver with no `options` resolves to its defaults. |
| `packages/parser-prisma`, `packages/gen-zod` | Existing driver tests should pass unchanged (runtime shape identical). Re-run both suites + `tsc -b`. |
| `packages/cli/src/commands/init.test.ts` | Unchanged (template string identical). |

## 7. Consequences / blast radius

- **Public API**: `@kurotako/config` gains `defineParser` / `defineGenerator`.
  `OptionsOf` is removed — it was exported via `export type *` but has no known
  external consumer (design-phase project, single repo). `TakoParser` /
  `TakoGenerator` unchanged.
- **Driver packages**: one-line declaration change each; no behavioural change,
  `parse` / `generate` bodies and signatures identical.
- **`load.ts`**: `undefined` → `{}` normalisation only when a schema is present;
  the schemaless and "explicit options object" paths are untouched.
- **No `@kurotako/core` change**: it never sees `options` typing; `load.ts`
  still curries a resolved value into `parse` / `generate`.

## Découpage en tâches d'implémentation

1. [`69-config-driver-options-helpers`](../../tasks/69-config-driver-options-helpers.md)
   ([#69](https://github.com/marmotz/kurotako/issues/69)) — `@kurotako/config`:
   `defineParser` / `defineGenerator`, `types.ts` rework (`DriverOptions`,
   `EntryOptions`, `OptionsMember`, drop `OptionsOf`), `load.ts` `undefined` → `{}`
   normalisation, `define.test-d.ts` + `load.test.ts`.
2. [`70-migrate-drivers-to-define-helpers`](../../tasks/70-migrate-drivers-to-define-helpers.md)
   ([#70](https://github.com/marmotz/kurotako/issues/70), depends on #69) — migrate
   `prismaParser` / `zodGenerator` to the helpers, add the uncommented-`CONFIG_TEMPLATE`
   compile fixture in `@kurotako/cli`.
