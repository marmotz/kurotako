# backend — gen-typescript: artifact, generate() wiring, release

**Statut** : à faire
**Type** : backend
**Issue** : [#123](https://github.com/marmotz/kurotako/issues/123)

Référence : [../features/generator-typescript/technical.md §Artifact](../features/generator-typescript/technical.md#artifact-artifactts--full-matrix--extra-decided),
[§Public contract](../features/generator-typescript/technical.md#public-contract-generatorts),
[§Tests](../features/generator-typescript/technical.md#tests-vitest-colocated).

## Constat vérifié

- [`packages/gen-zod/src/artifact.ts`](../../packages/gen-zod/src/artifact.ts) —
  `buildArtifact`: `entities[`${ns}.${entity}`]` via `iterEntities`, `symbols` = the
  full `names.ts` matrix, `ZodArtifactExtra` (`families`, `variants`, `perNamespace`).
  Port keeping only the `*Type` roles; drop `zodVersion` / `peerDependencies` / schema
  modules.
- [`packages/gen-zod/src/generator.ts`](../../packages/gen-zod/src/generator.ts) —
  `generate` loop over `Object.entries(ctx.ir.sources)`, `prefix = `${ns}/zod``,
  push `enums.ts` / `filters.ts` (if entities) / per-entity / `index.ts`, then
  `{ files, artifact }`.
- [`scripts/release-publish.sh:43`](../../scripts/release-publish.sh) iterates
  `packages/*/package.json` — new package included automatically, but the **first**
  publish of a new package is done manually/locally (npm OIDC trusted publishing).
- [`README.md:32`](../../README.md) / [`README.md:45`](../../README.md) list the shipped
  generators.

## À faire

1. `src/artifact.ts`: `TypeScriptArtifactExtra` (`families`, `variants`, `perNamespace:
   { barrelModule, filtersModule, scalarsModule, enums: { <name>: { constName, typeName,
   module } } }`); `buildArtifact(ir)` → `GeneratorArtifact` with
   `entities[`${ns}.${entity}`] = { module: `${ns}/typescript/${entity}.type`, symbols }`,
   `symbols` = `type` / `createType` / `updateType` / `whereType` / `selectType` +
   `deepType` / `createDeepType` / … . No `peerDependencies`.
2. `src/generator.ts`: implement `generate(ctx)` — per source, emit `scalars.ts`
   (only if a field maps to `JsonValue`), `enums.ts` (always), `filters.ts` (if ≥ 1
   entity), `<Entity>.type.ts` per entity, `index.ts`; return `{ files,
   artifact: buildArtifact(ctx.ir) }`.
3. `src/index.ts`: export the real `TypeScriptArtifactExtra`.
4. `.changeset/*.md`: `@kurotako/gen-typescript` at `minor` (new package, `0.1.0`).
5. `README.md`: add `@kurotako/gen-typescript` / `typescriptGenerator` to the install
   line and the import example.
6. Tests: end-to-end (literal `IR` → `generate` → assert file set + key substrings +
   artifact structure); determinism (same IR → deep-equal `GenOutput` on a second call,
   entity/field order preserved, imports sorted); cross-source relation degrade log.
7. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dépendances

[122-ts-gen-emit-entity-barrel](122-ts-gen-emit-entity-barrel.md).
