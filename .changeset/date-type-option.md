---
'@kurotako/ir': minor
'@kurotako/gen-zod': minor
'@kurotako/gen-typescript': minor
---

New `dateType` option on `gen-zod` and `gen-typescript` (`'date'` default, `'string'`, `'temporal'`) for `date`, `datetime` and time-of-day fields. `'string'` emits ISO 8601 strings (`z.iso.datetime()`, `z.iso.date()`, `z.iso.time()`); `'temporal'` emits `Temporal.Instant` / `PlainDate` / `PlainTime` and, in `gen-zod`, a generated `temporal.ts` whose schemas accept an ISO 8601 string or a Temporal object and output the Temporal object. This matches what Prisma 8 reads and writes for its `*-temporal` codecs, which `z.coerce.date()` and `Date` do not. With `temporal`, `Where` filters are split per class (`InstantFilter`, `PlainDateFilter`, `PlainTimeFilter`). `gen-typescript` now has an options schema (`TypeScriptGeneratorOptions`), and `generate` takes its options as a second argument.

`@kurotako/ir` adds `DateTypeSchema` / `DateType`, `dateTsType`, `temporalClass`, an optional `scalarTsType` options argument, and lets `FieldBuilder.format('time')` apply to a `datetime` field.
