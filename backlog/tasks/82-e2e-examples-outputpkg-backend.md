# examples/nestjs11-prisma7-angular22-outputpkg — NestJS backend

**Statut** : fait
**Type** : backend
**Issue** : [#82](https://github.com/marmotz/kurotako/issues/82)

Référence : [../features/e2e-examples/technical.md §NestJS backend (apps/backend)](../features/e2e-examples/technical.md#nestjs-backend-appsbackend).

## Constat vérifié

- Same shape as #80 — [80-e2e-examples-outputdir-backend](80-e2e-examples-outputdir-backend.md), except the Zod schema is imported from the workspace package `@example/tasks` instead of a relative `generated/kurotako` path.

## À faire

1. `TasksModule` / `TasksController` / `TasksService`, same `POST /tasks` + `GET /tasks` shape as the outputdir project, backed by Prisma Client.
2. Same `ZodValidationPipe implements PipeTransform` as #80 — [80-e2e-examples-outputdir-backend](80-e2e-examples-outputdir-backend.md) — copy, not shared code (the two example projects are fully standalone, per [overview.md](../features/e2e-examples/overview.md)).
3. Wire `POST /tasks` to validate with `TaskCreateSchema` imported from `@example/tasks` (the mode-B package, not a relative path).
4. `GET /tasks` returns the list including relations.
5. Manual verification: same as the outputdir backend task, run against `@example/tasks` instead of the relative generated output.

## Dépendances

Depends on #79 — [79-e2e-examples-outputpkg-scaffold](79-e2e-examples-outputpkg-scaffold.md).
