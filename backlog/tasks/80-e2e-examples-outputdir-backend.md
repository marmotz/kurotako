# examples/nestjs11-prisma7-angular22-outputdir — NestJS backend

**Statut** : fait
**Type** : backend
**Issue** : [#80](https://github.com/marmotz/kurotako/issues/80)

Référence : [../features/e2e-examples/technical.md §NestJS backend (apps/backend)](../features/e2e-examples/technical.md#nestjs-backend-appsbackend).

## Constat vérifié

- The scaffold task produces `apps/backend/generated/kurotako/tasks/zod/…` (Zod-only destination) and a working `apps/backend/prisma/schema.prisma` + Prisma Client.
- kurotako does not ship a NestJS integration — the validation pipe is hand-written, wrapping the generated Zod schema's own `.parse()` ([../features/e2e-examples/technical.md §Alternatives considered](../features/e2e-examples/technical.md#alternatives-considered) — `nestjs-zod` rejected for v1).

## À faire

1. `TasksModule` with a `TasksController` exposing `POST /tasks` and `GET /tasks`, backed by a `TasksService` wrapping `PrismaClient`.
2. `ZodValidationPipe implements PipeTransform` (generic, one Zod schema per instantiation) calling `schema.parse(value)`; on `ZodError`, throw a NestJS `BadRequestException` with the flattened issues.
3. Wire `POST /tasks` to validate its body with the generated `TaskCreateSchema` (imported from `../../generated/kurotako` — the barrel/subpath produced by `zodGenerator`) via the pipe above.
4. `GET /tasks` returns the list including `project`/`assignee` relations (Prisma `include`).
5. Manual verification: `bun run dev` (or the Nest equivalent) in `apps/backend`, `curl` both endpoints, confirm an invalid `POST /tasks` body is rejected with the Zod issues.

## Dépendances

Depends on #78 — [78-e2e-examples-outputdir-scaffold](78-e2e-examples-outputdir-scaffold.md).
