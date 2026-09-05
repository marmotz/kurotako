---
title: Parser and generator catalog
sidebar_position: 3
---

# Catalog

The parsers and generators shipped in v1. Each is a separate `@kurotako/*` package; you
install the ones your pipeline uses and import the exported parser or generator in
`tako.config.ts`.

## Parsers

### `@kurotako/parser-prisma`

Reads a Prisma schema and produces IR entities, fields, enums and relations.

- **Export:** `prismaParser` — the value you pass to `use` in a `sources` entry.
- **Name:** `prisma` — its `name` field, shown in diagnostics.

| Option | Type | Default | Notes |
|---|---|---|---|
| `schema` | `string` | `'./prisma/schema.prisma'` | path to the schema file, resolved against the config directory. Prisma's multi-file schema folder is supported. |
| `version` | `7` \| `8` | inferred | force the Prisma schema-engine version mode; omitted, it is inferred from the input. |

Unknown option keys are a hard error (a typo like `schemaPath` fails rather than being
ignored).

```ts
sources: {
  db: { use: prismaParser, options: { schema: './prisma/schema.prisma' } },
}
```

## Generators

### `@kurotako/gen-zod`

Emits Zod schemas from the IR — one file per entity, plus `enums.ts`, `filters.ts` and a
barrel, under `<namespace>/zod/`.

- **Export:** `zodGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `zod` — its `name` field; this is what another generator's `dependsOn` refers to.

| Option | Type | Default | Notes |
|---|---|---|---|
| `zodVersion` | `3` \| `4` | `4` | which Zod API flavor to emit. Explicit — the generator never probes the environment (it must stay pure for `tako check`). |

```ts
generators: [{ use: zodGenerator, options: { zodVersion: 4 } }]
```

### `@kurotako/gen-angular`

Emits TypeScript types, typed `FormGroup`s and `Validators` aligned on the schema
constraints, under `<namespace>/angular/`.

- **Export:** `angularGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `angular` — its `name` field.
- **Depends on:** `zod` (hard — `zod` must be in the `generators` array). It reuses the
  emitted Zod schemas.

| Option | Type | Default | Notes |
|---|---|---|---|
| `forms` | `('reactive' \| 'signal')[]` | `['reactive', 'signal']` | which form surfaces to emit |
| `relations` | `'flat'` \| `'deep'` | `'flat'` | `flat` = foreign-key scalars only; `deep` = nested `FormGroup` / `FormArray` |

```ts
generators: [
  { use: zodGenerator },
  { use: angularGenerator, options: { forms: ['reactive'], relations: 'deep' } },
]
```

## Adding your own

Parser and generator packages are plain packages whose entry is built with
`defineParser` / `defineGenerator` from `@kurotako/config`. The authoring guides
("writing a parser", "writing a generator") are a fast-follow; until then, the
[`@kurotako/config` API reference](../api/) documents the contract.
