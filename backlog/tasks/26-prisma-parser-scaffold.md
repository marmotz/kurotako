# backend — @kurotako/parser-prisma scaffold: options, driver object, errors

**Status**: to do **Type**: backend **Issue**: [#26](https://github.com/marmotz/kurotako/issues/26)

Reference: [../features/parser-prisma/technical.md §Package shape](../features/parser-prisma/technical.md#package-shape),
[§Dependencies](../features/parser-prisma/technical.md#dependencies) and
[§Public contract (`parser.ts` + `options.ts`)](../features/parser-prisma/technical.md#public-contract-parserts--optionsts).

## Verified

- `packages/parser-prisma/` is scaffolded by [#6](6-package-skeletons.md) with a
  placeholder `src/index.ts` (`export const version`) and one trivial test. This task
  replaces the placeholder with the real driver skeleton.
- Decided: one package, one `prisma` short name, internal version mode. `@prisma/internals`
  is a **peer dependency**; the exact range and the `getDMMF` call shape are pinned by the
  spike [#59](59-prisma-getdmmf-spike.md) (blocks this task). `@kurotako/core` /
  `@kurotako/config` are used for **types only**.
- `TakoParser<O>` shape (object, `name`, optional Valibot `optionsSchema`,
  `parse(ctx, options)`) is fixed by
  [config-system/technical.md §Config shape](../features/config-system/technical.md#config-shape-and-defineconfig-typests-definets);
  `ParseContext` (`{ namespace, cwd, logger }`) by
  [core-pipeline/technical.md §Driver contracts](../features/core-pipeline/technical.md#driver-contracts).
- `TakoError` base class lives in `@kurotako/core` ([#15](15-core-types-and-contracts.md)).

## To do

1. `packages/parser-prisma/package.json`:
   - `dependencies`: `@kurotako/ir` (`workspace:*`), `valibot`.
   - `peerDependencies`: `@kurotako/core` (`workspace:*`), `@kurotako/config`
     (`workspace:*`), `@prisma/internals` (range pinned by the spike
     [#59](59-prisma-getdmmf-spike.md) — expected `>=5 <8`, Prisma 8 being the deferred
     `contract.json` mode).
   - `devDependencies`: `@kurotako/core`, `@kurotako/config`, `@prisma/internals` (pinned,
     for the test suite).
   - keep `"sideEffects": false`.
2. `packages/parser-prisma/tsconfig.json` — `references`:
   `[{ "path": "../ir" }, { "path": "../core" }, { "path": "../config" }]`.
3. `packages/parser-prisma/src/options.ts`:
   - `export const PrismaParserOptions = v.object({ schema: v.optional(v.string(), './prisma/schema.prisma'), version: v.optional(v.picklist([7, 8])) })`.
   - `export type PrismaParserOptions = v.InferOutput<typeof PrismaParserOptions>`.
4. `packages/parser-prisma/src/errors.ts` — extend `TakoError` from `@kurotako/core`:
   - `PrismaInputError` (`prisma_input`) — schema path missing / empty folder / no `.prisma`.
   - `PrismaPeerMissingError` (`prisma_peer_missing`) — `@prisma/internals` cannot be
     resolved; message carries an install hint.
   - `PrismaSchemaError` (`prisma_schema`) — `getDMMF` threw; wraps `cause`, carries the
     namespace and the Prisma message.
5. `packages/parser-prisma/src/parser.ts`:
   - `export const prismaParser: TakoParser<PrismaParserOptions>` with `name: 'prisma'`,
     `optionsSchema: PrismaParserOptions`, and an `async parse(ctx, options)` that wires
     `resolveInput` → (`readDmmf` | `readContract`) → `buildSourceIR`. Import the three from
     their modules; they are implemented in the follow-up tasks (stub them here as
     `throw new Error('not implemented')` so the package builds, or land this task after
     the others — see Dependencies).
   - `parserVersion` passed to the builder is `` `prisma@${detectedVersion}` `` (resolved in
     the dmmf task; a literal `'prisma'` placeholder is acceptable until then).
   - `async watchPaths(ctx, options)`: `resolveInput(ctx.cwd, options)` then return the
     resolved `.prisma` file path(s) (mode 7 `input.files` paths) / `[input.contractPath]`
     (mode 8). Consumed by `tako generate --watch`
     ([cli/technical.md](../features/cli/technical.md#the-watchpaths-contract-addition)).
6. `packages/parser-prisma/src/index.ts` — barrel: `prismaParser`, `PrismaParserOptions`
   (type + schema), the error classes. Drop the placeholder `version` const.
7. `packages/parser-prisma/src/options.test.ts` — `PrismaParserOptions` parse: default
   `schema`, `version` picklist rejects `6`, unknown key rejected.
8. Fill the root solution `tsconfig.json` reference if not already present.
9. `bun run typecheck`, `bun run test`, `bun run build` green for the package.

## Dependencies

- [#59](59-prisma-getdmmf-spike.md) — spike pinning the `@prisma/internals` range + call shape
- [#6](6-package-skeletons.md)
- [#11](11-ir-types-and-version.md)
- [#14](14-ir-source-builder.md)
- [#15](15-core-types-and-contracts.md)
- [#22](22-config-types-and-errors.md)
