# backend — Migrate prismaParser / zodGenerator to the define helpers + `tako init` acceptance fixture

**Status**: done **Type**: backend

**Issue**: [#70](https://github.com/marmotz/kurotako/issues/70)

Reference: [../features/driver-options-ergonomics/technical.md §4](../features/driver-options-ergonomics/technical.md#4-driver-package-changes),
[§5](../features/driver-options-ergonomics/technical.md#5-config_template),
[§6](../features/driver-options-ergonomics/technical.md#6-tests).

## Constat vérifié

- `prismaParser` is declared `export const prismaParser: TakoParser<PrismaParserOptions> = {…}`
  ([`packages/parser-prisma/src/parser.ts:22`](../../../packages/parser-prisma/src/parser.ts))
  with a `watchPaths` member; `zodGenerator` likewise ([
  `packages/gen-zod/src/generator.ts:19`](../../../packages/gen-zod/src/generator.ts)).
- `PrismaParserOptions` = `v.strictObject({ schema: v.optional(v.string(),
  './prisma/schema.prisma'), version: v.optional(v.picklist([7, 8])) })`
  ([`packages/parser-prisma/src/options.ts:13-16`](../../../packages/parser-prisma/src/options.ts));
  `ZodGeneratorOptions` = `v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) })`
  ([`packages/gen-zod/src/options.ts:14-16`](../../../packages/gen-zod/src/options.ts)). Every field has a default or is
  optional ⇒ after task A the config entry
  `options` is **optional** for both, and `{ use: zodGenerator }` with no
  `options` loads.
- `@kurotako/gen-angular` has no generator object yet ([
  `packages/gen-angular/src/index.ts`](../../../packages/gen-angular/src/index.ts)
  is a version constant) — nothing to migrate.
- `CONFIG_TEMPLATE` ([`packages/config/src/template.ts`](../../../packages/config/src/template.ts))
  keeps its example lines commented; the acceptance is that uncommenting them verbatim compiles and runs.
- `@kurotako/cli` depends on `@kurotako/config` only; it is the owner of
  `tako init` / `CONFIG_TEMPLATE`. Neither `parser-prisma` nor `gen-zod` depends on the other or on `cli`, so `cli` is
  the one place a fixture can import
  `defineConfig` + both real drivers. Adding them as **devDependencies** of
  `cli` introduces no dependency cycle.

## À faire

1. `packages/parser-prisma/src/parser.ts` — replace the annotated
   `export const prismaParser: TakoParser<PrismaParserOptions> = {…}` with
   `export const prismaParser = defineParser({ name: 'prisma', optionsSchema:
   PrismaParserOptions, async parse(ctx, options) {…}, async watchPaths(ctx,
   options) {…} })`. Import `defineParser` from `@kurotako/config`; drop the
   `TakoParser` type import. `parse` / `watchPaths` bodies unchanged (`options`
   is `v.InferOutput<typeof PrismaParserOptions>`, identical to today's
   `PrismaParserOptions` alias).
2. `packages/gen-zod/src/generator.ts` — same swap:
   `export const zodGenerator = defineGenerator({ name: 'zod', optionsSchema:
   ZodGeneratorOptions, generate(ctx, options) {…} })`. Import `defineGenerator`
   from `@kurotako/config`; drop the `TakoGenerator` type import. `generate`
   body unchanged.
3. `packages/cli/package.json` — add `@kurotako/parser-prisma` and
   `@kurotako/gen-zod` as `devDependencies` (`workspace:*`).
4. `packages/cli/src/commands/init.test-d.ts` (new) — compile-only fixture:
   import `defineConfig` from `@kurotako/config`, `prismaParser`, `zodGenerator`, and paste the **uncommented** body of
   `CONFIG_TEMPLATE`
   (`sources: { pg: { use: prismaParser, options: { schema: './prisma/schema.prisma' } } }`,
   `generators: [{ use: zodGenerator }]`, `output: { dir: './generated/kurotako' }`)
   into a `defineConfig({…})` call assigned to an exported const. Add one
   `@ts-expect-error` line for an unknown Prisma option key (`options: { schemaPath: './x' }`) to pin strict-object
   rejection at the entry.
5. Run and show green:
  - `@kurotako/config`: `bun run typecheck` / `test` / `build` (unchanged by this task, sanity only).
  - `@kurotako/parser-prisma`: `bun run typecheck` / `test` / `build`.
  - `@kurotako/gen-zod`: `bun run typecheck` / `test` / `build`.
  - `@kurotako/cli`: `bun run typecheck` (compiles `init.test-d.ts`) / `test` /
    `build`.
  - existing `parser-prisma` / `gen-zod` runtime tests must pass unchanged (the driver objects are structurally
    identical).

## Dépendances

- [69-config-driver-options-helpers](69-config-driver-options-helpers.md)
