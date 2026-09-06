<!-- backlog-sync 2026-09-06T19:20Z — GENERATED, do not hand-edit. Regenerate: skill backlog-sync -->

# Backlog

## TypeScript generator (`@kurotako/gen-typescript`)  ·  [overview](features/generator-typescript/overview.md)

_technical design in [technical.md](features/generator-typescript/technical.md)_ — 0/6 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [ ]  | [#118](https://github.com/marmotz/kurotako/issues/118) | gen-typescript: package scaffold, names and errors | — |
| [ ]  | [#119](https://github.com/marmotz/kurotako/issues/119) | gen-typescript: scalar type, JSDoc, member assembly | #118 |
| [ ]  | [#120](https://github.com/marmotz/kurotako/issues/120) | gen-typescript: variant field sets and relation families | #119 |
| [ ]  | [#121](https://github.com/marmotz/kurotako/issues/121) | gen-typescript: emit enums.ts and filters.ts | #118 |
| [ ]  | [#122](https://github.com/marmotz/kurotako/issues/122) | gen-typescript: emit <Entity>.type.ts and the barrel | #120, #121 |
| [ ]  | [#123](https://github.com/marmotz/kurotako/issues/123) | gen-typescript: artifact, generate() wiring, release | #122 |

## IR union type  ·  [overview](features/ir-union-type/overview.md)

_technical design — [technical.md](features/ir-union-type/technical.md)_ — 3/6 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [ ]  | [#115](https://github.com/marmotz/kurotako/issues/115) | gen-zod: union / ref rendering, aliases.ts emit, artifact symbols | #114 |
| [ ]  | [#116](https://github.com/marmotz/kurotako/issues/116) | gen-angular: union control typing, discriminated sub-FormGroup, fallback | #115 |
| [ ]  | [#117](https://github.com/marmotz/kurotako/issues/117) | IR union type: integration (core info logging, parser-prisma regression, release notes) | #115, #116 |
| [x]  | [#112](https://github.com/marmotz/kurotako/issues/112) | IR union type: schema + types (ref/union kinds, TypeAlias, IR_VERSION 2) | — |
| [x]  | [#113](https://github.com/marmotz/kurotako/issues/113) | IR union type: validation (recursive field-type walk, alias pass, cycle info channel) | #112 |
| [x]  | [#114](https://github.com/marmotz/kurotako/issues/114) | IR union type: builder + helpers (f.ref / f.union / addTypeAlias, resolution helpers) | #112, #113 |

## Prisma 8 support in `@kurotako/parser-prisma`  ·  [overview](features/prisma-8-support/overview.md)

_conception technique — [technical.md](features/prisma-8-support/technical.md)_ — 0/5 tasks done

| Done | Issue | Title | Blocked by |
|------|-------|-------|------------|
| [ ]  | [#107](https://github.com/marmotz/kurotako/issues/107) | spike — capture the real Prisma 8 contract.json structure | — |
| [ ]  | [#108](https://github.com/marmotz/kurotako/issues/108) | Prisma 8 contract module scaffold: Valibot schema, version guard, errors | #107 |
| [ ]  | [#109](https://github.com/marmotz/kurotako/issues/109) | Prisma 8 codec -> IR ScalarType / format mapping (PostgreSQL) | #107, #108 |
| [ ]  | [#110](https://github.com/marmotz/kurotako/issues/110) | Prisma 8 contract.json -> PrismaModel reader | #108, #109 |
| [ ]  | [#111](https://github.com/marmotz/kurotako/issues/111) | Prisma 8: rename/prefix options + mode-8 parser wiring | #108, #110 |
