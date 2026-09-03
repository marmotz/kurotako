# Prisma parser (`@kurotako/parser-prisma`)

**Status**: technical design — [technical.md](technical.md)

## Context

The first and only parser of v1. Reads a `schema.prisma` and produces a partial IR. Must
handle the non-trivial cases (enums, relations, `Json`, `Decimal`, native `@db.*` types)
by drawing on how `prisma-zod-generator` / `zod-prisma-types` solved them, rather than
starting from scratch.

## Goal

A parser that covers a realistic `schema.prisma`: models, scalar fields, `?`/`[]`, `@id`,
`@unique`, `@default`, `@relation`, enums, native types, and the common metadata — mapped
onto a `SourceIR` conforming to [`@kurotako/ir`](../ir-model/overview.md). It must keep up
with Prisma's format shift: Prisma 8 (final imminent) replaces the DSL/DMMF model with an
emitted `contract.json`, so the parser is designed from the start to carry two version
modes behind one package.

## Decisions made

- Package `@kurotako/parser-prisma`, short name `prisma`
  ([ADR-0006](../../../docs/adr/0006-parser-generator-vocabulary.md)).
- Instantiable multiple times (several `schema.prisma` sources), each instance under its
  own namespace ([ADR-0003](../../../docs/adr/0003-multiple-parsers-namespaces.md)).
- Produces a `SourceIR` conforming to [`@kurotako/ir`](../ir-model/overview.md).
- **One package, two version modes.** `@kurotako/parser-prisma` handles both Prisma ≤ 7
  and Prisma 8 behind a single config key (`prisma`). The parser detects the input format
  (with an explicit `version` / mode override as an escape hatch) and switches its
  front-end; the IR-mapping logic (types, constraints, relations, metadata) is shared
  between modes. No second package, no second short name.
- **Prisma ≤ 7 mode — DMMF via `@prisma/internals` (`getDMMF`).** No home-grown DSL
  parser: Prisma's own tooling resolves enums, relations and native types. Accepted cost:
  a heavy dependency that follows Prisma's release pace and needs the query-engine
  resolution handled at runtime. This mode is the **v1 target**.
- **Prisma 8 mode — reads `contract.json` directly.** Prisma 8 emits its schema as a
  deterministic contract (`contract.json` + `contract.d.ts`). The parser consumes the
  already-emitted `contract.json`; the user is responsible for running
  `prisma contract emit` in their build. This mode has **zero `@prisma/*` dependency** and
  a fully deterministic input. It is a **fast-follow after Prisma 8 final**, not part of
  kurotako v1.
- **Multi-file Prisma (`prismaSchemaFolder`) supported in v1, transparently.** A parser
  instance points at a single `schema.prisma` *or* a schema folder; the DMMF merges the
  files. One instance = one logical schema = one namespace. (Prisma 8 mode is inherently
  single-artifact: one `contract.json`.)
- **Relations covered in full for v1**: 1-1, 1-n, explicit m2m (join model present),
  owning side, explicit FK field(s), `onDelete` / `onUpdate`. Implicit Prisma m2m (no
  join model in the schema) is **materialised**: the parser synthesises the hidden join
  table as an IR entity so downstream generators see a uniform model.
- **Prisma-native constraints only in v1.** `@id` / `@unique` → `unique`, `@default` →
  `default`, `@db.VarChar(n)` → `maxLength`, native types → `format` where one exists
  (e.g. `@db.Uuid` → `format: uuid`). `///` doc comments are carried verbatim into
  `IR.doc` with no interpretation. A richer directive syntax inside doc comments
  (`min` / `max` / custom `regex`) is deferred past v1.
- **Metadata populated from v1**: `///` doc comments, `@@map`, `@@unique` — feeding the
  fields already present in the IR. (Spike [#59](../../tasks/59-prisma-getdmmf-spike.md):
  DMMF exposes no non-unique `@@index` and no field-level `@map` — both dropped in v1, see
  `technical.md` Accepted limitations.)

## Settled in `technical.md`

- `@prisma/internals` is an **optional peer dependency** (`>=5 <8`; `getDMMF`, WASM-based,
  no engine binary at parse time); the parse follows the user's own Prisma version. Spike
  [#59](../../tasks/59-prisma-getdmmf-spike.md): on Prisma 7 the `prisma` CLI no longer
  bundles `@prisma/internals`, so the user adds it explicitly — otherwise a clear
  `PrismaPeerMissingError` with an install hint.
- Native `@db.*` types map to a scalar refinement + `constraints` (`string` +
  `format` for semantic types; `uuid` scalar only for `@db.Uuid` / `@db.ObjectId`).
- `Field.optional` = `hasDefaultValue || isUpdatedAt`; `nullable` follows `?` separately.
- Implicit m2m is materialised as a readable synthetic entity (`${A}${B}`, `<model>Id`
  FKs, composite PK).
- Version-mode detection from the input (`*.prisma` / folder → mode 7, `contract.json` →
  mode 8), with an explicit `version` override.

## Still open (Prisma 8 mode only, deferred)

- `contract.json` type vocabulary → `ScalarType` / `format` mapping.
- Whether Prisma 8 still emits implicit m2m.
- `contract.json` schema versioning / validation.

## Deferred past kurotako v1

- **Prisma 8 mode** (`contract.json` reader) — fast-follow once Prisma 8 is stable. Gets
  its own task set; the v1 work must not hard-code assumptions that block it.

## Depends on

- [ir-model](../ir-model/overview.md), [core-pipeline](../core-pipeline/overview.md).
