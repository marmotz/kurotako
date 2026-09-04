# backend — @kurotako/config `outputs[]`: types, schema, load, errors, template

**Status**: done
**Type**: backend
**Issue**: [#74](https://github.com/marmotz/kurotako/issues/74)

Reference: [../features/output-modes/technical.md §Multiple outputs (`outputs[]`) — `@kurotako/config` changes](../features/output-modes/technical.md#kurotakoconfig-changes),
[§Errors](../features/output-modes/technical.md#errors-core-errorsts-all-extend-takoerror),
[§Consequences — `config-system/technical.md` amendment](../features/output-modes/technical.md#config-systemtechnicalmd--outputs-amendment-multiple-outputs-new-task).

## Verified

- `packages/config/src/types.ts` currently declares `OutputOption` without a `generators`
  field, and `TakoConfig.output?: OutputOption` (optional, singular).
- `packages/config/src/schema.ts` (`TakoConfigSchema.output`, lines 49–57) is an
  `v.optional(v.object({ dir?, mode?, packagesDir?, scope?, packageManager? }))`.
- `packages/config/src/load.ts`: the mode-`'package'` cross-field check (`packagesDir` +
  `scope` + `NPM_SCOPE_RE`, lines 108–132) and the `resolvedOutput: OutputConfig`
  construction (lines 178–188) both run once, against `config.output ?? {}`. The
  `generators[].namespaces` unknown-namespace check (lines 94–106) is the direct model for
  the new unknown-generator check.
- `packages/config/src/errors.ts`'s `UnknownNamespaceError` (lines 83–95) is the direct
  model for the new `UnknownGeneratorError`.
- `packages/config/src/template.ts`'s `CONFIG_TEMPLATE` ends with
  `output: { dir: './generated/kurotako' }`.
- Depends on [73-core-outputs-array](73-core-outputs-array.md): `load.ts` imports
  `OutputConfig` / `ResolvedConfig` from `@kurotako/core`, and builds
  `resolved.outputs: OutputConfig[]` — the `outputs` field and `generators` member must
  exist on core's types first.

## To do

1. `packages/config/src/types.ts`:
   - `OutputOption` gains `generators?: string[]`.
   - `TakoConfig.output?: OutputOption` → `TakoConfig.outputs: readonly OutputOption[]`
     (required — no default synthesized by `defineConfig`).
2. `packages/config/src/schema.ts`: replace the `output: v.optional(v.object({...}))`
   member with
   ```ts
   outputs: v.pipe(
     v.array(v.object({
       dir: v.optional(v.string()),
       mode: v.optional(v.picklist(['dir', 'package'])),
       packagesDir: v.optional(v.string()),
       scope: v.optional(v.string()),
       packageManager: v.optional(v.picklist(['bun', 'pnpm', 'yarn', 'npm'])),
       generators: v.optional(v.array(v.pipe(v.string(), v.minLength(1)))),
     })),
     v.minLength(1),
   ),
   ```
3. `packages/config/src/errors.ts`: new `UnknownGeneratorError`, mirroring
   `UnknownNamespaceError`:
   ```ts
   export class UnknownGeneratorError extends TakoError {
     readonly outputIndex: number
     readonly generator: string
     constructor(outputIndex: number, generator: string) {
       super(
         'config_unknown_generator',
         `outputs[${outputIndex}] restricts to generator '${generator}', which is not declared in generators`,
       )
       this.outputIndex = outputIndex
       this.generator = generator
     }
   }
   ```
4. `packages/config/src/load.ts`:
   - Run the existing mode-`'package'` cross-field check **per entry** of
     `config.outputs` instead of once against a single `config.output ?? {}`.
   - Add a new cross-field check alongside the `namespaces` allowlist loop: for each
     `outputs[i]`, every name in `entry.generators ?? []` must be a key already collected
     in `seenGenerators` (the generator-name set built by the existing duplicate-name
     loop) → else throw `UnknownGeneratorError(i, name)`.
   - Build `resolvedOutputs: OutputConfig[]`, one entry per `config.outputs[i]`: same
     per-field resolution as today's single `resolvedOutput` (absolutize `dir` /
     `packagesDir` against `rootDir`, pass `scope` / `packageManager` through), plus carry
     `generators` through unchanged (already-validated names — core does not re-validate).
   - `resolved.outputs = resolvedOutputs`.
5. `packages/config/src/template.ts`: `CONFIG_TEMPLATE`'s
   `output: { dir: './generated/kurotako' }` → `outputs: [{ dir: './generated/kurotako' }]`.
6. Tests:
   - `schema.test.ts`: `outputs: []` (empty array) fails `v.minLength(1)`; a minimal
     one-entry `outputs` passes.
   - `load.test.ts`: `outputs[1].generators: ['nope']` with a config only declaring a
     `zod` generator → `UnknownGeneratorError` naming index `1` and `'nope'`; two outputs,
     one `mode: 'dir'` and one `mode: 'package'` missing `scope` → `ConfigShapeError` for
     the second entry only, the first entry unaffected; a valid two-entry `outputs` →
     `ResolvedConfig.outputs` has two entries, each `dir` / `packagesDir` absolutized
     independently against `rootDir`.
   - `template.test.ts`: `CONFIG_TEMPLATE` still parses under `TakoConfigSchema` with its
     `outputs: [...]` array.
7. `bun run typecheck`, `bun run test`, `bun run build` green for `packages/config`.

## Dependencies

Depends on #73
- [73-core-outputs-array](73-core-outputs-array.md)
