# Backlog — tracking

Each feature goes through `backlog-discuss` then `backlog-technical` before `backlog-tasks`.
GitHub issues live on `marmotz/kurotako` (see [AGENTS.md](AGENTS.md)). Completed features
are archived in [`_archives/done.md`](_archives/done.md).

## IR union type

[features/ir-union-type/overview.md](features/ir-union-type/overview.md) — technical design:
[technical.md](features/ir-union-type/technical.md). Blocks OpenAPI parser.

| Fait | Issue                                                  | Tâche                                                                 | Description                                                                                                         |
|------|--------------------------------------------------------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| [x]  | [#112](https://github.com/marmotz/kurotako/issues/112) | [112-ir-union-schema-types](tasks/112-ir-union-schema-types.md)       | `schemas.ts` `ref`/`union` kinds + `TypeAlias` + `SourceIR.typeAliases?`, recursive `FieldType`, `IR_VERSION = '2'` |
| [x]  | [#113](https://github.com/marmotz/kurotako/issues/113) | [113-ir-union-validation](tasks/113-ir-union-validation.md)           | `validate.ts` recursive field-type walk, alias pass, non-fatal cycle `info` channel, new `IrIssueCode`s             |
| [x]  | [#114](https://github.com/marmotz/kurotako/issues/114) | [114-ir-union-builder-helpers](tasks/114-ir-union-builder-helpers.md) | builder `f.ref` / `f.union` / `addTypeAlias`, helpers `resolveRef` / `flattenUnion`, exhaustive `scalarTsType`      |
| [ ]  | [#115](https://github.com/marmotz/kurotako/issues/115) | [115-gen-zod-union](tasks/115-gen-zod-union.md)                       | gen-zod `z.union` / `z.discriminatedUnion` / `z.lazy`, `aliases.ts` emit, artifact alias symbols                    |
| [ ]  | [#116](https://github.com/marmotz/kurotako/issues/116) | [116-gen-angular-union](tasks/116-gen-angular-union.md)               | gen-angular union control typing, discriminated sub-`FormGroup` + runtime switch, `FormControl` fallback            |
| [ ]  | [#117](https://github.com/marmotz/kurotako/issues/117) | [117-ir-union-integration](tasks/117-ir-union-integration.md)         | core `info` logging, parser-prisma regression, run-pipeline test with `typeAliases`, changesets                     |

## OpenAPI parser

[features/parser-openapi/overview.md](features/parser-openapi/overview.md) — in discussion. Blocked by IR union type.

| Task       | Issue | Status |
|------------|-------|--------|
| _none yet_ |       |        |

## TypeScript generator

[features/generator-typescript/overview.md](features/generator-typescript/overview.md) — technical design:
[technical.md](features/generator-typescript/technical.md). Pure-types sibling of gen-zod; standalone in v1.

| Fait | Issue                                                  | Tâche                                                                     | Description                                                                                            |
|------|--------------------------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| [ ]  | [#118](https://github.com/marmotz/kurotako/issues/118) | [118-ts-gen-scaffold](tasks/118-ts-gen-scaffold.md)                       | package skeleton, `src/errors.ts`, `src/names.ts` (Dto matrix), `generator.ts` skeleton, barrel        |
| [ ]  | [#119](https://github.com/marmotz/kurotako/issues/119) | [119-ts-gen-scalars-jsdoc-field](tasks/119-ts-gen-scalars-jsdoc-field.md) | `render/scalars.ts` (wraps `scalarTsType`), `render/jsdoc.ts`, `render/field.ts`, `emit/scalars.ts`    |
| [ ]  | [#120](https://github.com/marmotz/kurotako/issues/120) | [120-ts-gen-variants-relations](tasks/120-ts-gen-variants-relations.md)   | `render/variants.ts` (IR shared-decision helpers), `render/relations.ts` (flat/deep, cross-source)     |
| [ ]  | [#121](https://github.com/marmotz/kurotako/issues/121) | [121-ts-gen-emit-enums-filters](tasks/121-ts-gen-emit-enums-filters.md)   | `emit/enums.ts` (const + type, collision guard), `emit/filters.ts` (Where operator interfaces)         |
| [ ]  | [#122](https://github.com/marmotz/kurotako/issues/122) | [122-ts-gen-emit-entity-barrel](tasks/122-ts-gen-emit-entity-barrel.md)   | `emit/entity.ts` (per-entity, 5x2 matrix, sorted type-only imports), `emit/barrel.ts`                  |
| [ ]  | [#123](https://github.com/marmotz/kurotako/issues/123) | [123-ts-gen-artifact-and-wiring](tasks/123-ts-gen-artifact-and-wiring.md) | `artifact.ts` (+ `TypeScriptArtifactExtra`), `generate()` wiring, changeset, README, e2e + determinism |

## Prisma 8 support

[features/prisma-8-support/overview.md](features/prisma-8-support/overview.md) — technical design:
[technical.md](features/prisma-8-support/technical.md)

| Fait | Issue                                                  | Tâche                                                                     | Description                                                                                                |
|------|--------------------------------------------------------|---------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| [ ]  | [#107](https://github.com/marmotz/kurotako/issues/107) | [107-prisma8-contract-spike](tasks/107-prisma8-contract-spike.md)         | Spike: emit a real Prisma 8 `contract.json`, commit the fixture, record its structure                      |
| [ ]  | [#108](https://github.com/marmotz/kurotako/issues/108) | [108-prisma8-contract-schema](tasks/108-prisma8-contract-schema.md)       | `src/contract/` scaffold: Valibot schema, `schemaVersion` guard, 4 error classes, `prisma@8` devDep        |
| [ ]  | [#109](https://github.com/marmotz/kurotako/issues/109) | [109-prisma8-codec-mapping](tasks/109-prisma8-codec-mapping.md)           | `codecs.ts`: `pg/*` codec → IR `ScalarType` / `format`, `@N` tolerance, dialect error                      |
| [ ]  | [#110](https://github.com/marmotz/kurotako/issues/110) | [110-prisma8-contract-reader](tasks/110-prisma8-contract-reader.md)       | `read.ts`: `contract.json` → `PrismaModel` (namespace flatten, `storage` join, relation edges)             |
| [ ]  | [#111](https://github.com/marmotz/kurotako/issues/111) | [111-prisma8-options-and-wiring](tasks/111-prisma8-options-and-wiring.md) | `namespacePrefix` / `rename` options + naming resolution, mode-7 rename pass, mode-8 wiring in `parser.ts` |
