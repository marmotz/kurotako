---
'@kurotako/ir': minor
'@kurotako/gen-zod': minor
'@kurotako/gen-typescript': minor
'@kurotako/gen-openapi': minor
'@kurotako/parser-prisma': minor
---

New `read` variant (`UserReadSchema` / `UserReadDto`, plus `UserReadDeepSchema` / `UserReadDeepDto`) in `gen-zod` and `gen-typescript`, next to `full`, `create`, `update`, `where` and `select`. It is the shape of a stored row: fields that have a default (`id`, `createdAt`, ...) are required, and fields marked `hidden` are absent, nested relations included.

`@kurotako/ir` adds `Field.hidden`, `FieldBuilder.hidden()`, `readFields` and `isReadOptional`. `@kurotako/parser-prisma` marks a field hidden from the new `hidden` option (`{ User: ['passwordHash'] }`, Prisma 7 and 8, an unknown entry is an error) or from a `/// @kurotako.hidden` doc annotation (Prisma 7 mode; a Prisma 8 contract carries no doc comments). `gen-openapi` leaves hidden fields out of `components/schemas`.

`parser-prisma` also records ORM-generated defaults (`@default(uuid())`, `@updatedAt`, Prisma 8 generators) as expression defaults, so those fields read back as required, and keeps `format: 'time'` on `@db.Time` columns.
