# backend — @kurotako/gen-angular per-entity file, runtime file, barrel, artifact and generate() wiring

**Status**: done **Type**: backend **Issue**: [#43](https://github.com/marmotz/kurotako/issues/43)

Reference: [../features/generator-angular/technical.md §File layout](../features/generator-angular/technical.md#file-layout-per-namespace-ns),
[§Artifact (`artifact.ts`)](../features/generator-angular/technical.md#artifact-artifactts),
[§Determinism](../features/generator-angular/technical.md#determinism),
[§Tests](../features/generator-angular/technical.md#tests-vitest-colocated).

## Verified

- A generator returns `{ files: VirtualFile[]; artifact: GeneratorArtifact }` with
  `<ns>/angular/`-prefixed POSIX paths ([output-modes](../features/output-modes/technical.md)
  amendment — one sub-tree per generator, core synthesizes `<ns>/index.ts`); core owns
  collision detection, ordering and the Writer
  ([core-pipeline/technical.md](../features/core-pipeline/technical.md)).
- `ctx.ir` is already namespace-filtered and key-ordered; the generator must preserve
  that order (drift-guard).
- `GeneratorArtifact` = `{ entities: Record<`${ns}.${entity}`, EntitySymbols>, extra? }`.

## To do

1. `packages/gen-angular/src/emit/entity.ts`:
   `entityFile(entity, ns, options, zod, logger): VirtualFile` — assembles
   `<ns>/<entity>.form.ts`: control-tree interfaces + reactive factory (if `reactive`) +
   Signal Forms schema/model (if `signal`) + deep relation additions (if `relations:
   'deep'`); imports sorted by module specifier, named imports sorted.
2. `packages/gen-angular/src/emit/runtime.ts`: assemble the full
   `<ns>/zod-forms.runtime.ts` file (both `zodValidator` and `zodTreeValidate` as enabled
   by `options.forms`); emitted once per namespace when the source has ≥ 1 entity and
   `forms` is non-empty.
3. `packages/gen-angular/src/emit/barrel.ts`: `<ns>/angular/index.ts` — `export *` from
   every emitted file. A zero-entity source still emits an `index.ts`.
4. `packages/gen-angular/src/artifact.ts`: build `GeneratorArtifact` — `entities` keyed
   `${ns}.${entity}`, `EntitySymbols.module === `${ns}/angular/${entity}.form``, `symbols`
   with roles `createControls` / `createForm` / `updateControls` / `updateForm` /
   `factory` / `createSchema` / `updateSchema` / `createModel` / `updateModel` (+ `*Deep*`
   when `relations: 'deep'`); `peerDependencies` = `{ '@angular/core', '@angular/forms' }`
   at `>=22` when `options.forms` includes `'signal'`, else `>=17`; `extra:
   AngularArtifactExtra` (`forms`, `relations`, `zodVersion` echoed from the consumed Zod
   artifact, `perNamespace: { runtimeModule, barrelModule }` — both `<ns>/angular/…`).
5. `packages/gen-angular/src/generator.ts`: implement `generate(ctx, options)` — iterate
   `ctx.ir.sources`, read `ctx.dependencies.zod` via `zod-artifact.ts`, emit files +
   assemble the artifact. Synchronous, pure.
6. `src/index.ts`: replace the `AngularArtifactExtra` placeholder with the real type.
7. `packages/gen-angular/src/*.test.ts` (end to end, fixture IR + fake Zod artifact):
   - `forms: []` → types + models only, no runtime file;
   - imports sorted; barrel re-exports every file; enum control type imported per the
     artifact `extra`;
   - artifact: `entities` keys, `module` (`<ns>/angular/<entity>.form`), every role
     present, `peerDependencies` reflects the `forms` option (`>=22` with `signal`, else
     `>=17`), `extra` echoes options and `zodVersion`;
   - determinism: same IR + artifact + options → deep-equal `GenOutput` on a second call;
     entity/field order preserved.
8. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [42-gen-angular-relations-deep](42-gen-angular-relations-deep.md)
- [48-output-root-barrel-and-banner](48-output-root-barrel-and-banner.md) — the synthesized
  `<ns>/index.ts` + the `<ns>/<generatorName>/` collision guard must exist before zod and
  angular run together through `run()` ([output-modes/technical.md §Work-ordering
  consequence](../features/output-modes/technical.md#work-ordering-consequence)).
