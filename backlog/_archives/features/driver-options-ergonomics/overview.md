# Driver options ergonomics (`options` on config entries)

**Status**: technical design ready — see [`technical.md`](./technical.md)

## Context

Reported while running `tako generate` for the first time against a real project, using a
config straight out of `tako init` (`CONFIG_TEMPLATE`):

```ts
export default defineConfig({
  sources: {
    pg: { use: prismaParser, options: { schema: './libs/db/prisma/schema.prisma' } },
  },
  generators: [{ use: zodGenerator }],
  output: { dir: './generated/kurotako' },
})
```

Two failures, same area:

1. **Typecheck** — on the `pg` source entry:
   `TS2322: Type '{ schema: string; }' is not assignable to type 'undefined'. The expected
   type comes from property 'options' … on type …`.
   The `options` field of a source/generator entry is typed `undefined`, so passing any
   object is a type error — even though `prismaParser` clearly has an `optionsSchema`.

2. **Runtime** — with `generators: [{ use: zodGenerator }]` (no `options`, exactly as the
   template shows):
   ```
   tako error [driver_options_invalid]: invalid options for generator 'zod': <root>: Invalid type: Expected Object but received undefined
     - <root>: Invalid type: Expected Object but received undefined
     generator: zod
   ```

So the config that `tako init` writes does not typecheck and does not run.

## Root causes (identified, not yet fixed)

### a. `OptionsOf<D>` cannot see an optional `optionsSchema`

[`packages/config/src/types.ts`](../../../../packages/config/src/types.ts):

```ts
export type OptionsOf<D> = D extends {
  optionsSchema: v.GenericSchema<unknown, infer O>;   // required property
} ? O : undefined;
```

The driver contract declares `optionsSchema?:` **optional**
(`TakoParser<O>` / `TakoGenerator<O>`), and every driver is annotated with that interface
type:

```ts
// packages/parser-prisma/src/parser.ts
export const prismaParser: TakoParser<PrismaParserOptions> = { … optionsSchema: PrismaParserOptions, … }
// packages/gen-zod/src/generator.ts
export const zodGenerator: TakoGenerator<ZodGeneratorOptions> = { … optionsSchema: ZodGeneratorOptions, … }
```

Because the annotation widens the concrete `optionsSchema` property to `… | undefined`,
`{ optionsSchema?: X }` does **not** satisfy `{ optionsSchema: X }`, and `OptionsOf`
collapses to `undefined` for every driver. `SourceEntry` / `GeneratorEntry` then type
`options?: undefined`.

### b. `load.ts` feeds `undefined` to a non-optional object schema

[`packages/config/src/load.ts`](../../../../packages/config/src/load.ts) `parseDriverOptions`:
when an entry omits `options`, it calls `v.safeParse(schema, undefined)`. The generator
schemas are plain objects whose fields are all optional-with-default but the object itself
is not:

```ts
// packages/gen-zod/src/options.ts
export const ZodGeneratorOptions = v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) });
```

`v.object({...})` rejects `undefined`, hence `driver_options_invalid`. A driver whose every
option has a default must work with no `options` key at all — that is the whole point of
`{ use: zodGenerator }` in the template.

### c. Entry `options` type uses the schema's Output, not its Input

`OptionsOf` infers `O` from `v.GenericSchema<unknown, infer O>` — the **Output**. For
`prismaParser`, `schema` has a default (`v.optional(v.string(), './prisma/schema.prisma')`),
so the Output type makes `schema` **required**. A user writing `options: {}` (or
`options: { version: 7 }`) would get a type error for a missing `schema`, even though the
default covers it. The entry should accept the schema's **Input** type.

## Goal

The config produced by `tako init` typechecks and runs unchanged. Passing `options` to a
driver that declares an `optionsSchema` is fully typed (autocomplete on the option keys,
error on unknown keys / wrong types); omitting `options` is valid whenever the schema can
produce a value from `undefined`.

## Decisions made

- **(a) Declaration helpers in `@kurotako/config`.** Add `defineParser` /
  `defineGenerator`; they infer everything from the passed object, including the
  literal `optionsSchema` type (which the `: TakoParser<O>` annotation erases, verified
  in TS 5.9 — so a config-only `OptionsOf` fix cannot deliver typed autocomplete).
  Each driver package changes one line (annotation → helper call); the `parse` /
  `generate` bodies are unchanged and now type-checked against the schema Output.
- **(b) Normalise the missing-`options` case in `load.ts`.** When an entry omits
  `options` and the driver declares an `optionsSchema`, `parseDriverOptions` validates
  `{}` (not `undefined`) against the schema. Driver authors do not have to wrap their
  schema in `v.optional(v.object(…), {})`; a driver whose options all have defaults just
  works with `{ use: driver }`.
- **(c) Entry type = schema Input, driver receives schema Output.** The config entry's
  `options` is typed `v.InferInput<schema>` (defaults are optional for the user, unknown
  keys / wrong types still rejected). `load.ts` applies defaults and the driver's
  `parse` / `generate` continues to receive `v.InferOutput<schema>`.
- **`options` is required at the type level when the schema requires it.** If
  `v.InferInput<schema>` has any required field (an option with no default and no
  `undefined`-tolerance), the `options` key is mandatory in the config entry — a
  compile error instead of a runtime `driver_options_invalid`. Otherwise `options` is
  optional.
- **Driver without `optionsSchema` ⇒ `options?: never`.** Passing any `options` object
  to such a driver is a type error. `load.ts` keeps accepting `undefined` for that path.

## Acceptance

- The config emitted by `tako init` (`CONFIG_TEMPLATE`) typechecks and runs `tako generate`
  unchanged.
- Tests to add: a `defineConfig` `test-d.ts` asserting `options` is typed and required
  for a schema-bearing driver with a required option, optional for an all-default driver,
  and `never` for a schema-less driver; a `load.test.ts` case for `{ use: <all-default
  generator> }` with no `options`.

## Depends on / touches

- [`@kurotako/config`](../config-system/overview.md) — `types.ts` (`OptionsOf`,
  `SourceEntry`, `GeneratorEntry`), `load.ts` (`parseDriverOptions`), `define.test-d.ts`.
- [`@kurotako/parser-prisma`](../parser-prisma/overview.md),
  [`@kurotako/gen-zod`](../generator-zod/overview.md),
  [`@kurotako/gen-angular`](../generator-angular/overview.md) — driver declaration style
  and option schemas.
- [cli](../cli/overview.md) — `tako init` output is the acceptance test.
