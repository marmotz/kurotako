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

Reads either a Prisma 7 schema (through DMMF) or a Prisma 8 PostgreSQL
`contract.json`, and produces IR entities, fields, enums and relations.

- **Export:** `prismaParser` — the value you pass to `use` in a `sources` entry.
- **Name:** `prisma` — its `name` field, shown in diagnostics.

| Option            | Type                     | Default                    | Notes                                                                                                                     |
|-------------------|--------------------------|----------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `schema`          | `string`                 | `'./prisma/schema.prisma'` | path to the schema file, resolved against the config directory. Prisma's multi-file schema folder is supported.           |
| `version`         | `7` \| `8`               | inferred                   | force the input mode; omitted, it is inferred from a Prisma schema, `contract.json`, or a directory containing one.       |
| `namespacePrefix` | `Record<string, string>` | —                          | Prisma 8 only: prepends a prefix to every model from the named Prisma namespace. Ignored with a warning in Prisma 7 mode. |
| `rename`          | `Record<string, string>` | —                          | overrides an entity name. Keys are `Entity` in Prisma 7 mode and `namespace.Entity` in Prisma 8 mode.                     |

Unknown option keys are a hard error (a typo like `schemaPath` fails rather than being
ignored).

```ts
sources: {
  db: {
    use: prismaParser, options
  :
    {
      schema: './prisma/schema.prisma'
    }
  }
,
}
```

For Prisma 8, emit the contract with Prisma first, then point the parser at it:

```ts
sources: {
  db: {
    use: prismaParser, options
  :
    {
      schema: './prisma/generated/contract.json', version
    :
      8, rename
    :
      {
        'public.User'
      :
        'Account'
      }
    ,
    }
  ,
  }
,
}
```

Prisma 8 support is currently PostgreSQL-first. Unknown PostgreSQL codecs are preserved
as unknown IR fields; a foreign database dialect, an unsupported contract version, an
invalid contract, a post-rename entity collision, or an ambiguous cross-namespace relation
fails with one of the exported `Prisma*Error` classes.

### `@kurotako/parser-openapi`

Reads an OpenAPI 3.0 or 3.1 document (local JSON/YAML or an unauthenticated HTTP (S) URL)
and produces IR entities, type aliases, enums and typed maps from `components.schemas`
and every reachable inline schema in operations (request bodies, responses, parameters).

- **Export:** `openapiParser` — the value you pass to `use` in a `sources` entry.
- **Name:** `openapi` — its `name` field, shown in diagnostics.

| Option     | Type     | Default | Notes                                                                                                         |
|------------|----------|---------|---------------------------------------------------------------------------------------------------------------|
| `document` | `string` | —       | required; a local path resolved against the config directory, or an `http:`/`https:` URL with no credentials. |

Unknown option keys are a hard error. References are resolved (not dereferenced) by
`@apidevtools/json-schema-ref-parser`; unsupported schemes, credential-bearing URLs,
unresolved references, name collisions, and unsupported JSON Schema keywords each fail
with one of the exported `OpenApi*Error` classes.

```ts
sources: {
  api: {
    use: openapiParser, options
  :
    {
      document: './openapi.yaml',
    }
  ,
  }
,
}
```

## Generators

### `@kurotako/gen-zod`

Emits Zod schemas from the IR — one file per entity, plus `enums.ts`, `filters.ts` and a
barrel, under `<namespace>/zod/`.

- **Export:** `zodGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `zod` — its `name` field; this is what another generator's `dependsOn` refers to.

| Option       | Type       | Default | Notes                                                                                                                     |
|--------------|------------|---------|---------------------------------------------------------------------------------------------------------------------------|
| `zodVersion` | `3` \| `4` | `4`     | which Zod API flavor to emit. Explicit — the generator never probes the environment (it must stay pure for `tako check`). |

```ts
generators: [ { use: zodGenerator, options: { zodVersion: 4 } } ]
```

### `@kurotako/gen-angular`

Emits TypeScript types, typed `FormGroup`s and `Validators` aligned on the schema
constraints, under `<namespace>/angular/`.

- **Export:** `angularGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `angular` — its `name` field.
- **Depends on:** `zod` (hard — `zod` must be in the `generators` array). It reuses the
  emitted Zod schemas.

| Option      | Type                         | Default                  | Notes                                                                        |
|-------------|------------------------------|--------------------------|------------------------------------------------------------------------------|
| `forms`     | `('reactive' \| 'signal')[]` | `['reactive', 'signal']` | which form surfaces to emit                                                  |
| `relations` | `'flat'` \| `'deep'`         | `'flat'`                 | `flat` = foreign-key scalars only; `deep` = nested `FormGroup` / `FormArray` |

```ts
generators: [ { use: zodGenerator }, { use: angularGenerator, options: { forms: [ 'reactive' ], relations: 'deep' } }, ]
```

### `@kurotako/gen-typescript`

Emits pure TypeScript type declarations from the IR — no runtime dependency on generated
code. One `<Entity>.type.ts` file per entity, plus `enums.ts`, `filters.ts`, `aliases.ts`
when the source has type aliases, `scalars.ts` when a `JsonValue` helper is needed, and a
barrel, under `<namespace>/typescript/`.

- **Export:** `typescriptGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `typescript` — its `name` field.
- **Depends on:** nothing. No options.

Each entity yields five variants (`full`, `create`, `update`, `where`, `select`) in both
relation families (`flat`, `deep`), named `${Entity}${Variant}${Family}Dto` — e.g.
`User`, `UserCreateDto`, `UserDeepDto`.

```ts
generators: [ { use: typescriptGenerator } ]
```

### `@kurotako/gen-openapi`

Emits one OpenAPI 3.0/3.1 document (`components/schemas` only — no `paths`/operations)
per namespace from the IR — entities, type aliases and enums, including relations (rendered nested via `$ref`,
cross-source relations omitted) and a discriminated-union
mapping symmetric to `@kurotako/parser-openapi`.

- **Export:** `openapiGenerator` — the value you pass to `use` in a `generators` entry.
- **Name:** `openapi` — its `name` field.
- **Depends on:** nothing.

| Option           | Type                 | Default       | Notes                            |
|------------------|----------------------|---------------|----------------------------------|
| `openapiVersion` | `'3.0'` \| `'3.1'`   | `'3.1'`       | which OpenAPI version to target. |
| `format`         | `'json'` \| `'yaml'` | `'json'`      | output serialization.            |
| `title`          | `string`             | the namespace | document `info.title`.           |
| `version`        | `string`             | `'0.0.0'`     | document `info.version`.         |

```ts
generators: [ { use: openapiGenerator, options: { format: 'yaml', title: 'My API' } } ]
```

## Adding your own

Parser and generator packages are plain packages whose entry is built with
`defineParser` / `defineGenerator` from `@kurotako/config`. The authoring guides ("writing a parser", "writing a
generator") are a fast-follow; until then, the
[`@kurotako/config` API reference](../api/) documents the contract.
