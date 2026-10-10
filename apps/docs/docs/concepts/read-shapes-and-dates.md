---
title: Read shapes and dates
sidebar_position: 5
---

# Read shapes and dates

Two things decide whether the generated types fit what your ORM returns and what your
HTTP layer should send: how a row **reads back**, and how a **date** is represented.

## The `Read` variant

Every entity yields six variants (`full`, `create`, `update`, `read`, `where`, `select`) in
both relation families. `read` is the shape of a stored row, as a response carries it:

| Variant | `id` / `createdAt` (have a default) | A field marked `hidden` |
|---------|--------------------------------------|-------------------------|
| `full` (`UserSchema`) | optional, as in the source | present |
| `create` (`UserCreateSchema`) | optional, falls back to the default | present |
| `read` (`UserReadSchema`) | **required** | **absent** |

A field is optional on read only when the source makes it optional *and* gives it no
default (a nullable column without a default, for instance). A default that the ORM
generates (`@default(uuid())`, `@updatedAt`) counts, in Prisma 7 and in a Prisma 8
contract alike.

```ts
// before: UserSchema.omit({ passwordHash: true, createdAt: true }).required({ id: true })
import { UserReadSchema, type UserReadDto } from '@myapp/db/zod';
```

The deep family exists too (`UserReadDeepSchema`): its relations point at the target's
`read` schema, so a hidden field of a nested entity is dropped as well.

Hidden fields only leave the `read` variant. `create`, `update`, `where` and `select` keep
them, because the server still writes and filters on a password hash. `gen-openapi` also
leaves them out of `components/schemas`, since that component describes a response.

## Hiding a field

Mark the field in the Prisma parser, in either of two ways:

```ts
sources: {
  db: {
    use: prismaParser,
    options: {
      schema: './prisma/generated/contract.json',
      hidden: { User: ['passwordHash'] },
    },
  },
},
```

```prisma
model User {
  /// @kurotako.hidden
  passwordHash String
}
```

- `options.hidden` works in both Prisma modes. Keys are entity names **as they appear in
  the IR** (after `rename` and `namespacePrefix`). An entry that matches no entity or
  field is an error, so a typo cannot leave a field exposed.
- The `/// @kurotako.hidden` annotation needs doc comments, which the Prisma 7 schema
  carries but a Prisma 8 `contract.json` does not. The tag line is removed from the
  field's `doc`.

Hiding a whole model is not supported; list its sensitive fields, or leave the model out
of your `outputs`.

## Date types {#date-types}

The IR has two date scalars, `date` and `datetime`; a time of day is a `datetime` with
`format: 'time'`. How they are emitted is the `dateType` option of `gen-zod` and
`gen-typescript`:

| `dateType` | `datetime` | `date` | time of day | Use when |
|------------|-----------|--------|-------------|----------|
| `'date'` (default) | `Date` / `z.coerce.date()` | same | same | the ORM hands out `Date` (Prisma 7, most drivers) |
| `'string'` | ISO 8601 string (`z.iso.datetime()`) | `z.iso.date()` | `z.iso.time()` | a wire format, or an ORM reading `*-string` columns |
| `'temporal'` | `Temporal.Instant` | `Temporal.PlainDate` | `Temporal.PlainTime` | the ORM reads and writes Temporal objects (Prisma 8 `*-temporal` codecs) |

With Prisma 8, `DateTime` columns use the `pg/timestamptz-temporal` codec: the ORM
returns a `Temporal.Instant` and refuses a `Date`
(`RUNTIME.ENCODE_FAILED ... encodes a Temporal.Instant, but received a Date`), so set
`dateType: 'temporal'` for the schemas to match it.

```ts
generators: [
  { use: typescriptGenerator, options: { dateType: 'temporal' } },
  { use: zodGenerator, options: { zodVersion: 4, dateType: 'temporal' } },
],
```

The `temporal` schemas accept an ISO 8601 string (an HTTP body) **or** a Temporal object
(an ORM row) and output the Temporal object, so one schema validates the request and the
row. A string that is not valid ISO 8601 is reported as a validation issue, never thrown.
They live in a generated `temporal.ts`, which touches the global `Temporal` only when it
parses. Serialising a `Temporal` value with `JSON.stringify` gives its ISO 8601 string.

Requirements of `dateType: 'temporal'`:

- a global `Temporal` at runtime (Node 26+, or a polyfill loaded before parsing);
- its types at compile time. TypeScript 6 ships them (`lib: ["esnext.temporal"]`); on
  TypeScript 5 add `temporal-spec` and `"types": ["temporal-spec/global"]` to the
  `tsconfig.base.json` that mode B's generated package extends, or its `.d.ts` build fails
  with `TS2304`.

Limits:

- The IR does not tell `timestamp` (Prisma `Temporal.PlainDateTime`) from `timestamptz`
  (`Temporal.Instant`): every timestamp maps to `Instant`. Columns declared without a
  time zone need the string or `date` representation.
- With `temporal`, each Temporal class has its own `Where` filter (`InstantFilter`,
  `PlainDateFilter`, `PlainTimeFilter`) instead of the shared `DateTimeFilter`.
- `gen-angular` keeps `Date` in its forms: a native date input produces one, and a browser
  has no `Temporal` yet. Its private Zod copy ignores `dateType`. In a package shared by an
  API and a browser app, keep `temporal` for the server and let the browser read the JSON
  (`string`) instead.

## Availability

| Change | Packages (first version) |
|--------|--------------------------|
| `<scope>/<ns>/zod`, `/typescript`, `/angular` resolve in mode B; angular and react-tanstack out of the root entry point | `@kurotako/core` 0.4.0, `@kurotako/gen-angular` 0.5.0, `@kurotako/gen-react-tanstack` 0.2.0 |
| `dateType` | `@kurotako/gen-zod` 0.5.0, `@kurotako/gen-typescript` 0.5.0, `@kurotako/ir` 0.7.0 |
| `read` variant, `hidden` fields | `@kurotako/gen-zod` 0.5.0, `@kurotako/gen-typescript` 0.5.0, `@kurotako/gen-openapi` 0.4.0, `@kurotako/parser-prisma` 0.3.0, `@kurotako/ir` 0.7.0 |

The meta package `kurotako` carries them from 0.3.0.
