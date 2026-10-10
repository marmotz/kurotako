# nestjs11-prisma8-angular22-outputpkg

End-to-end example: NestJS 11 + Angular 22 + Prisma 8 contract mode, consuming
kurotako's mode B (`package`) output through the shared `@example/tasks` workspace
package. It mirrors the Prisma 7 package-output example; the output mode, Nest app and
Angular app are retained while Prisma moves to its PostgreSQL contract workflow.

Prisma 8 currently uses PostgreSQL contracts. Set `DATABASE_URL` to a PostgreSQL
connection string before using the Prisma commands. `apps/backend/prisma/contract.prisma`
is the source of truth; `contract.json` is generated and is consumed by `tako.config.ts`.

## Setup and generation

Link the same seven local kurotako packages as the Prisma 7 package-output example, then
run `bun install` from this directory.

```bash
export DATABASE_URL='postgresql://user:password@localhost:5432/kurotako_example'
bun run prisma:contract # emits apps/backend/prisma/generated/contract.json
bun run prisma:db:init  # applies and signs the PostgreSQL contract
bun run tako:generate   # writes and builds packages/example-tasks
```

Mode `package` needs `tsconfig.base.json` and `tsup.config.base.ts` one level above
`packagesDir` (committed here; `tako init --package-base` creates them without overwriting),
and `typescript`, `zod`, `@angular/core` and `@angular/forms` resolvable from the generated
package. See [Output modes](https://kurotako.marmotz.dev/docs/reference/output-modes#mode-b-prerequisites).

`packages/example-tasks` is regenerable (gitignored) except for a committed
`package.json` stub — see the Prisma 7 package-output example's README ("Generate"
section) for why it's needed to bootstrap `bun install` on a fresh clone.

Re-emit the contract before regenerating kurotako after every `contract.prisma` change.
The Nest service uses Prisma 8's PostgreSQL ORM runtime instead of Prisma 7's generated
client and SQLite driver adapter.

## Run

```bash
cd apps/backend && bun run start:dev
cd apps/frontend && bun run start
```

## Dates and hidden fields

Prisma 8 reads and writes `DateTime` columns as `Temporal.Instant`, so `tako.config.ts`
sets `dateType: 'temporal'` on `typescriptGenerator` and `zodGenerator`: the generated
schemas accept an ISO 8601 string (an HTTP body) or an Instant (an ORM row). This needs a
global `Temporal` at runtime (Node 26+, or a polyfill) and its types at compile time,
which `temporal-spec` and `"types": ["temporal-spec/global"]` in `tsconfig.base.json`
provide for the generated package's `.d.ts` build.

`User.passwordHash` is listed under the parser's `hidden` option, so it is absent from
every `*Read*` schema. `TasksController.list()` parses the ORM rows with
`TaskReadDeepSchema`, which drops it from the nested `assignee`. See
[Read shapes and dates](https://kurotako.marmotz.dev/docs/concepts/read-shapes-and-dates).

The apps import the sub-paths `@example/tasks/zod` and `@example/tasks/angular/...`;
`@example/tasks/angular` no longer comes with the root `@example/tasks` entry point.

## Zod generator and `gen-angular`

`tako.config.ts` keeps `zodGenerator` because the apps import the `zod` sub-tree
themselves. `gen-angular` does not need it: it embeds its own private Zod copy under
`<namespace>/angular/zod/` (its forms import from there), so a config that only wants
Angular forms can drop the `zod` entry. Here both copies are generated.
