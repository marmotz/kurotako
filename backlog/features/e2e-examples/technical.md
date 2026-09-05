# End-to-end example projects — technical design

Product decisions come from [overview.md](overview.md). This document turns them into
a concrete directory layout, a Prisma schema, two `tako.config.ts` files (one per
output mode), and the NestJS/Angular wiring that consumes the generated code for real.

## Starting point

- **No code exists.** `examples/` does not exist yet at the repo root.
- Root `package.json` declares `workspaces: ["packages/*", "apps/*"]`
  ([package.json:5-8](../../../package.json)) — `examples/*` is deliberately **not**
  added to that list (overview decision: standalone, no root workspace tie).
- Root `vitest.config.ts` only globs `packages/*/vitest.config.ts`
  ([vitest.config.ts](../../../vitest.config.ts)) — already excludes `examples/`, no
  change needed there.
- Root `biome.json` `files.includes` is `["**", "!**/dist", "!**/coverage",
  "!**/*.tsbuildinfo", "!apps/docs/build", ...]` ([biome.json:8-18](../../../biome.json))
  — currently would still walk into `examples/**` (own source, own conventions). Needs
  a `"!examples/**"` entry, same pattern already used for `apps/docs/build`.
- Root `.gitignore` has generic `dist`, `node_modules`, `coverage`, `*.tsbuildinfo`
  entries plus per-package `tmp-*` exclusions
  ([.gitignore](../../../.gitignore)) — generic entries already cover each example's own
  `node_modules`/`dist`; the Prisma-generated / tako-generated output directories still
  need explicit entries (below).
- Reference driver contracts used below: `PrismaParserOptions`
  ([packages/parser-prisma/src/options.ts:13-16](../../../packages/parser-prisma/src/options.ts)),
  `ZodGeneratorOptions` ([packages/gen-zod/src/options.ts:11-13](../../../packages/gen-zod/src/options.ts)),
  `AngularGeneratorOptions`
  ([packages/gen-angular/src/options.ts:8-16](../../../packages/gen-angular/src/options.ts)),
  `TakoConfig` / `OutputOption` shape
  ([packages/config/src/types.ts:116-142](../../../packages/config/src/types.ts)),
  `defineParser`/`defineGenerator` ([packages/config/src/define-driver.ts:19-53](../../../packages/config/src/define-driver.ts)),
  mode-B package layout
  ([output-modes/technical.md §packageWriter](../output-modes/technical.md)).
- **`parser-prisma`'s `version: 8` mode is not implemented**
  ([packages/parser-prisma/src/parser.ts:29-34](../../../packages/parser-prisma/src/parser.ts)
  throws `'the Prisma 8 contract.json mode is not implemented in kurotako v1'`); the
  supported Prisma npm range is `>=5 <8`
  ([packages/parser-prisma/package.json:37](../../../packages/parser-prisma/package.json)).
  This is why both example projects target `version: 7` (DMMF mode) and differ by
  **output mode** instead (overview decision, revised after this finding).

## Scope recap

Two example projects, same Prisma schema domain, same parser/generator versions,
differing only in kurotako output mode:

- `examples/nestjs11-prisma7-angular22-outputdir/` — output mode **A** (`dir`), one
  destination per app.
- `examples/nestjs11-prisma7-angular22-outputpkg/` — output mode **B** (`package`), one
  shared workspace package consumed by both apps.

## Prisma schema (shared domain)

A small task manager: `User` / `Project` / `Task`, `Task` has a required relation to
`Project` (1-N) and an optional relation to `User` (1-N, nullable FK) — enough to
exercise both a mandatory and an optional relation, and both `relations: 'flat'` and
`relations: 'deep'` on the Angular generator (§Angular generator options below).

```prisma
// apps/backend/prisma/schema.prisma (identical in both example projects)
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String @id @default(cuid())
  email        String @unique
  name         String
  assignedTasks Task[] @relation("AssignedTasks")
}

model Project {
  id    String @id @default(cuid())
  name  String
  tasks Task[]
}

model Task {
  id         String   @id @default(cuid())
  title      String
  done       Boolean  @default(false)
  project    Project  @relation(fields: [projectId], references: [id])
  projectId  String
  assignee   User?    @relation("AssignedTasks", fields: [assigneeId], references: [id])
  assigneeId String?
}
```

SQLite (`prisma-client-js` provider, file datasource) is used purely so `prisma
migrate dev` / a seed script can run with zero external services — the point of these
examples is exercising kurotako's generated code, not showcasing a particular
database backend.

## Directory layout — `…-outputdir/` (mode A)

```
examples/nestjs11-prisma7-angular22-outputdir/
  package.json            # private, workspaces: ["apps/*"], own bun.lock
  bun.lock
  biome.json              # example manages its own lint/format, independent of root
  tsconfig.base.json
  tako.config.ts
  README.md               # setup steps (bun link, prisma migrate, tako generate, run)
  apps/
    backend/              # NestJS 11
      package.json
      prisma/schema.prisma
      src/
        app.module.ts
        tasks/
          tasks.controller.ts
          tasks.module.ts
          tasks.service.ts
          zod-validation.pipe.ts   # generic PipeTransform, calls schema.parse()
      generated/kurotako/          # tako output — gitignored
    frontend/             # Angular 22
      package.json
      src/
        app/
          app.config.ts
          tasks/
            task-list.component.ts     # signals-based fetch (httpResource) + list
            task-create-form.component.ts   # reactive strategy (FormGroup factory)
            task-edit-form.component.ts     # signal strategy (signal form factory)
            tasks-api.service.ts
      generated/kurotako/          # tako output — gitignored
```

`tako.config.ts` (mode A, two destinations, generator subset per destination):

```ts
import { defineConfig } from '@kurotako/config';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {
    tasks: prismaParser({
      schema: './apps/backend/prisma/schema.prisma',
      version: 7,
    }),
  },
  generators: [
    zodGenerator({ zodVersion: 4 }),
    angularGenerator({ forms: ['reactive', 'signal'], relations: 'flat' }),
  ],
  outputs: [
    { dir: './apps/backend/generated/kurotako', generators: ['zod'] },
    { dir: './apps/frontend/generated/kurotako' },
  ],
});
```

The backend destination restricts to `generators: ['zod']`
([`OutputOption.generators`](../output-modes/technical.md#runts-amendments) — omitted
name defaults to every generator that ran): NestJS only ever imports the Zod
validators, never the Angular form factories. The frontend destination omits
`generators` (defaults to all), since it needs both — Zod schemas (client-side
`.parse()` before submit) and Angular form factories.

`relations: 'flat'` here (FK scalars only, e.g. `projectId: FormControl<string>`) —
the deeper nested-form rendering is exercised by the other example project instead
(§Angular generator options).

## Directory layout — `…-outputpkg/` (mode B)

```
examples/nestjs11-prisma7-angular22-outputpkg/
  package.json            # private, workspaces: ["apps/*", "packages/*"], own bun.lock
  bun.lock
  biome.json
  tsconfig.base.json
  tako.config.ts
  README.md
  packages/
    example-tasks/        # generated by tako (mode B) — gitignored, tako owns this dir
  apps/
    backend/               # NestJS 11 — same shape as above
      package.json          # dependency: "@example/tasks": "workspace:*"
      prisma/schema.prisma  # identical schema
      src/... (same as outputdir, imports from '@example/tasks' instead of a relative
                generated/ path)
    frontend/               # Angular 22 — same shape as above
      package.json          # dependency: "@example/tasks": "workspace:*"
      src/... (same as outputdir, imports from '@example/tasks')
```

`tako.config.ts` (mode B, one shared package, both generators, `relations: 'deep'`):

```ts
import { defineConfig } from '@kurotako/config';
import { prismaParser } from '@kurotako/parser-prisma';
import { zodGenerator } from '@kurotako/gen-zod';
import { angularGenerator } from '@kurotako/gen-angular';

export default defineConfig({
  sources: {
    tasks: prismaParser({
      schema: './apps/backend/prisma/schema.prisma',
      version: 7,
    }),
  },
  generators: [
    zodGenerator({ zodVersion: 4 }),
    angularGenerator({ forms: ['reactive', 'signal'], relations: 'deep' }),
  ],
  outputs: [
    {
      mode: 'package',
      packagesDir: './packages',
      scope: '@example',
      packageManager: 'bun',
    },
  ],
});
```

Per [output-modes/technical.md §packageWriter](../output-modes/technical.md), this
produces `packages/example-tasks/` (`<scope-without-@>-<ns>` = `example-tasks`) with
`package.json.name: "@example/tasks"`. Both apps declare `"@example/tasks":
"workspace:*"` — the root example `package.json`'s own `workspaces` array must list
`packages/*` alongside `apps/*` for that workspace protocol reference to resolve
(unlike the root kurotako repo, which does not need `packages/*` generated at runtime —
here it is a build product of `tako generate`, committed to `.gitignore`, but still a
declared workspace member so `bun install` links it).

`relations: 'deep'` here — `Task`'s form nests a `FormGroup` for `project` (required)
and a lazily-built one for `assignee` (optional), instead of flat `projectId`/
`assigneeId` scalars. Deliberately different from the other example project so both
relation-rendering modes get exercised somewhere in `examples/`.

## Consuming kurotako packages (both projects)

Per [overview.md §Decisions already made](overview.md): each example's `package.json`
declares kurotako packages as ordinary dependencies, resolved from the registry once
published. Every kurotako package is currently pinned at `0.0.0`
([e.g. packages/cli/package.json:3](../../../packages/cli/package.json)) — pre-release,
unpublished — so the example pins the **exact** version `"0.0.0"` (not `^0.0.0`; a
caret range on a `0.0.x` version only ever matches that exact version under npm semver
anyway, but exact is clearer intent here) for:

```jsonc
{
  "devDependencies": {
    "@kurotako/cli": "0.0.0",
    "@kurotako/parser-prisma": "0.0.0",
    "@kurotako/gen-zod": "0.0.0",
    "@kurotako/gen-angular": "0.0.0"
  }
}
```

For local testing before these are published, `bun link` substitutes the registry
resolution with the locally built package — documented as a setup step in each
example's `README.md`, not encoded in `package.json`:

```bash
# from the kurotako repo root, once, after any change to a linked package:
bun run build
cd packages/cli            && bun link && cd -
cd packages/parser-prisma   && bun link && cd -
cd packages/gen-zod         && bun link && cd -
cd packages/gen-angular     && bun link && cd -

# from the example project root, once per clone:
bun link @kurotako/cli @kurotako/parser-prisma @kurotako/gen-zod @kurotako/gen-angular
bun install
```

Only these four packages need an explicit `bun link`: `@kurotako/core`,
`@kurotako/config`, `@kurotako/ir` are transitive dependencies declared inside those
four packages' own `package.json` (as `workspace:*` inside the kurotako repo); Node's
module resolution walks up from the linked package's real path
(`packages/parser-prisma/`) to the kurotako repo root `node_modules`, where the root
Bun workspace already hoists their symlinks. `@kurotako/gen-angular` itself has a
`peerDependency` on `@kurotako/gen-zod` (mentioned in the investigation of
`packages/gen-angular/package.json`) — already covered by linking `gen-zod` explicitly
above.

## NestJS backend (`apps/backend`)

- NestJS 11, one `TasksModule` (`create` / `list` endpoints — `POST /tasks`, `GET
  /tasks`) backed by Prisma Client (the *runtime* `@prisma/client`, generated by
  `prisma generate` from the same `schema.prisma` — unrelated to kurotako, this is
  Prisma's own client generation the app needs to talk to the database; kurotako only
  generates the Zod/Angular validation layer, per
  [docs/architecture.md](../../docs/architecture.md) "kurotako does not replace an
  ORM's own client").
- Request validation: a small local `ZodValidationPipe implements PipeTransform`
  (standard NestJS custom-pipe pattern, not a kurotako package — kurotako does not ship
  a NestJS integration) wrapping the generated `TaskCreateSchema.parse(value)`,
  imported from the tako output (`generated/kurotako` in the `-outputdir` project,
  `@example/tasks` in the `-outputpkg` project). Thrown `ZodError` is mapped to a 400
  with the flattened issues.
- This is the "real NestJS request validation" leg of the overview's goal: the same
  schema the frontend uses to validate client-side is the one validating the request
  server-side — no hand-duplicated validation rules.

## Angular frontend (`apps/frontend`)

Angular 22, standalone components, three pieces to cover the "fetch → form →
validate → submit" flow from the overview and exercise **both** form strategies
(`forms: ['reactive', 'signal']`):

- `TasksApiService` — `HttpClient`-based, `GET /tasks` / `POST /tasks`.
- `TaskListComponent` — signals-based data fetching (Angular's `resource`/
  `httpResource` over `TasksApiService`), rendering the fetched list.
- `TaskCreateFormComponent` — uses the generated **reactive** factory
  (`createTaskCreateForm(): FormGroup<...>` from `@kurotako/gen-angular`'s reactive
  render surface), validates with the generated Zod schema before `POST`, surfaces
  Zod issues as Angular form errors.
- `TaskEditFormComponent` — uses the generated **signal** factory (`taskUpdateModel`/
  `zodTreeValidate` surface from `@kurotako/gen-angular`'s signal render surface,
  per [generator-angular/technical.md](../generator-angular/technical.md)), same
  validate-then-submit flow, demonstrating the signal-forms API side by side with the
  reactive one.

## `.gitignore` / `biome.json` additions

Mode A's `generated/kurotako` and mode B's whole `packages/example-tasks/` (source
included, not just `dist`) are both entirely regenerable from `tako generate` — neither
is committed, so drift from the schema is never silently possible:

```gitignore
# examples/ — regenerable tako output, not committed
examples/*/apps/*/generated
examples/*/packages/*/src
examples/*/packages/*/dist
examples/*/packages/*/package.json
examples/*/packages/*/tsconfig.json
```

(The last three lines cover the whole `packages/example-tasks/` mode-B package — every
file under it is written by `tako generate`, per
[output-modes/technical.md §packageWriter](../output-modes/technical.md); only the
directory itself is worth keeping trackable, which `.gitignore` still allows since it
ignores contents, not never-created directories.)

`biome.json` (`files.includes`, [biome.json:8-18](../../../biome.json)):

```diff
  "files": {
    "includes": [
      "**",
      "!**/dist",
      "!**/coverage",
      "!**/*.tsbuildinfo",
      "!apps/docs/build",
      "!apps/docs/.docusaurus",
      "!apps/docs/docs/api",
-     "!apps/docs/versioned_docs"
+     "!apps/docs/versioned_docs",
+     "!examples/**"
    ]
  },
```

Each example manages its own formatting/linting independently (or none at all) — same
"fully standalone, not managed by the root" posture as its `package.json`. This also
keeps `lefthook.yml`'s pre-commit `biome check --staged {staged_files}`
([lefthook.yml:3-6](../../../lefthook.yml)) from reformatting example sources with the
root's rule set.

## `examples/README.md`

A short root-level doc (not part of either project) listing both example projects, the
support matrix each one exercises (parser version × output mode), and a pointer to
each project's own `README.md` for its setup steps. Kept short — the per-project
`README.md` carries the actual commands (§Consuming kurotako packages above, plus
`bunx prisma migrate dev`, `bunx tako generate`, `bun run dev` for each app).

## Alternatives considered

- **One example project covering both output modes via `outputs[]` on the same
  config** (mode A and mode B destinations in one `tako.config.ts`). Rejected: mode
  B's shared package changes how the apps import generated code (`@example/tasks` vs a
  relative `generated/kurotako` path) — mixing both in one project would need
  conditional imports for no real benefit, and the overview's own goal is "every
  supported combination has a project", which reads more clearly as one project per
  combination.
- **A single NestJS+Angular Nx workspace instead of two flat Bun-workspace apps.**
  Rejected: kurotako's own repo is a plain Bun workspace (no Nx), and the overview
  explicitly asked each example to be structured "exactly like this repo kurotako" —
  introducing a second build-orchestration tool would work against that stated
  familiarity goal.
- **`nestjs-zod` (or another third-party Nest/Zod integration package) instead of a
  hand-written `ZodValidationPipe`.** Rejected for v1: pulls in an unrelated dependency
  whose own conventions (decorator-based DTOs) would blur what is kurotako-generated
  versus library glue; a 15-line custom `PipeTransform` keeps the example's dependency
  on kurotako's own output explicit and easy to read end to end.

## What stays out of this feature

- **Any change to a kurotako package's runtime code.** Purely additive: two new
  standalone projects under `examples/`, plus the root `.gitignore` / `biome.json`
  entries needed to keep them out of root tooling's way.
- **CI for these examples** — overview decision, dev-only for now.
- **A third example project** (another Prisma version / the `contract.json` mode) —
  deferred until `parser-prisma`'s `version: 8` mode ships (overview §Starting scope).
- **Publishing kurotako packages to a registry** — a prerequisite this feature's
  `README.md` setup steps route around via `bun link`, not something this feature
  does.

## Découpage en tâches d'implémentation

Task files under [`../../tasks/`](../../tasks/), GitHub issues on `marmotz/kurotako`.

1. [#77 root-tooling](../../tasks/77-e2e-examples-root-tooling.md) — `.gitignore` /
   `biome.json` exclusions, `examples/README.md` (deps: none).
2. [#78 outputdir-scaffold](../../tasks/78-e2e-examples-outputdir-scaffold.md) — Bun
   workspace, Prisma schema, `tako.config.ts` (mode A, two destinations) (dep: #77).
3. [#79 outputpkg-scaffold](../../tasks/79-e2e-examples-outputpkg-scaffold.md) — Bun
   workspace, Prisma schema, `tako.config.ts` (mode B, shared package) (dep: #77).
4. [#80 outputdir-backend](../../tasks/80-e2e-examples-outputdir-backend.md) — NestJS
   `TasksModule` + `ZodValidationPipe` (dep: #78).
5. [#81 outputdir-frontend](../../tasks/81-e2e-examples-outputdir-frontend.md) —
   Angular list/create(reactive)/edit(signal) components, flat relations (dep: #78).
6. [#82 outputpkg-backend](../../tasks/82-e2e-examples-outputpkg-backend.md) — NestJS
   `TasksModule` + `ZodValidationPipe`, consuming `@example/tasks` (dep: #79).
7. [#83 outputpkg-frontend](../../tasks/83-e2e-examples-outputpkg-frontend.md) —
   Angular list/create(reactive)/edit(signal) components, deep relations (dep: #79).
