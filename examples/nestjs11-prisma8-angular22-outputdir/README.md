# nestjs11-prisma8-angular22-outputdir

End-to-end example: NestJS 11 + Angular 22 + Prisma 8 contract mode, consuming
kurotako's mode A (`dir`) output. It is the Prisma 8 counterpart to the Prisma 7
output-directory example: the Nest and Angular applications and their generated
kurotako destinations are unchanged; only the Prisma contract, runtime and database
workflow differ.

Prisma 8 currently uses PostgreSQL contracts. Set `DATABASE_URL` to a PostgreSQL
connection string before using the Prisma commands. The contract source is
`apps/backend/prisma/contract.prisma`; its generated `contract.json` is deliberately
not committed and is the file consumed by `tako.config.ts`.

## Setup and generation

Link the same five local kurotako packages as the Prisma 7 output-directory example,
then run `bun install` from this directory.

```bash
export DATABASE_URL='postgresql://user:password@localhost:5432/kurotako_example'
bun run prisma:contract # emits apps/backend/prisma/generated/contract.json
bun run prisma:db:init  # applies and signs the PostgreSQL contract
bun run tako:generate   # writes apps/{backend,frontend}/generated/kurotako
```

Run `prisma:contract` before `tako:generate` whenever `contract.prisma` changes.
The Nest service uses Prisma 8's PostgreSQL ORM runtime (`db.orm.public.Task`) rather
than Prisma 7's generated `PrismaClient`.

## Run

```bash
cd apps/backend && bun run start:dev
cd apps/frontend && bun run start
```
