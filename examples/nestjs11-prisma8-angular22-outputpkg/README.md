# nestjs11-prisma8-angular22-outputpkg

End-to-end example: NestJS 11 + Angular 22 + Prisma 8 contract mode, consuming
kurotako's mode B (`package`) output through the shared `@example/tasks` workspace
package. It mirrors the Prisma 7 package-output example; the output mode, Nest app and
Angular app are retained while Prisma moves to its PostgreSQL contract workflow.

Prisma 8 currently uses PostgreSQL contracts. Set `DATABASE_URL` to a PostgreSQL
connection string before using the Prisma commands. `apps/backend/prisma/contract.prisma`
is the source of truth; `contract.json` is generated and is consumed by `tako.config.ts`.

## Setup and generation

Link the same six local kurotako packages as the Prisma 7 package-output example, then
run `bun install` from this directory.

```bash
export DATABASE_URL='postgresql://user:password@localhost:5432/kurotako_example'
bun run prisma:contract # emits apps/backend/prisma/generated/contract.json
bun run prisma:db:init  # applies and signs the PostgreSQL contract
bun run tako:generate   # writes and builds packages/example-tasks
```

Re-emit the contract before regenerating kurotako after every `contract.prisma` change.
The Nest service uses Prisma 8's PostgreSQL ORM runtime instead of Prisma 7's generated
client and SQLite driver adapter.

## Run

```bash
cd apps/backend && bun run start:dev
cd apps/frontend && bun run start
```
