# nestjs11-openapi-angular22-outputdir

End-to-end example: a NestJS 11 API is the **contract producer** and Angular 22 is the
**generated consumer**, wired by `@kurotako/parser-openapi` in mode A (`dir`).

Unlike the Prisma examples there is **no database**: `apps/backend` keeps tasks in
memory. The point is the OpenAPI -> kurotako -> frontend pipeline.

## How it flows

1. `apps/backend/src/tasks/dto.ts` — hand-written DTO classes decorated with
   `@nestjs/swagger` + `class-validator`. They are the single source of truth.
2. `bun run openapi:emit` — boots the Nest app without listening and writes
   `apps/backend/openapi.json` (committed; also served at `/docs` when the app runs).
3. `bun run tako:generate` — `@kurotako/parser-openapi` reads `openapi.json`; the Zod
   and Angular generators write `apps/frontend/generated/kurotako/` (mode A: plain
   `.ts` straight into the app, compiled by Angular's own AOT pipeline).
4. `apps/frontend` imports `tasks/zod` (schemas + inferred DTO types) and
   `tasks/angular` (the `NewTaskFormFactory` reactive factory and the
   `createNewTask*Form` Signal Forms wrappers).

Re-run `openapi:emit` then `tako:generate` after every change to a controller or a DTO.

`Task.labels` is a `Record<string, string>` (`additionalProperties`), so this example
also exercises kurotako's IR v3 typed-map support end to end (`z.record(...)` in Zod, a
`FormControl<Record<string, string>>` in the generated form).

## Setup

Kurotako packages are consumed via `bun link` from this local clone:

```bash
# from the repo root, once, after any change to a linked package:
bun run --filter '*' build
cd packages/cli           && bun link && cd -
cd packages/config        && bun link && cd -
cd packages/parser-openapi && bun link && cd -
cd packages/gen-zod       && bun link && cd -
cd packages/gen-angular   && bun link && cd -
```

```bash
# from this project's root, once per clone:
bun link @kurotako/cli @kurotako/config @kurotako/parser-openapi @kurotako/gen-zod @kurotako/gen-angular
bun install
```

## Generate

```bash
bun run openapi:emit   # apps/backend/openapi.json
bun run tako:generate  # apps/frontend/generated/kurotako/
```

## Run

```bash
cd apps/backend && bun run start:dev    # NestJS on http://localhost:3000, Swagger UI at /docs
cd apps/frontend && bun run start       # Angular dev server
```

```bash
curl http://localhost:3000/tasks
curl -X POST http://localhost:3000/tasks -H 'content-type: application/json' \
  -d '{"projectId":"p1"}'   # missing title -> 400
```

## Tests

```bash
cd apps/backend  && bun run test:e2e
cd apps/frontend && bun run test
```
