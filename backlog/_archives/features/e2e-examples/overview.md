# End-to-end example projects

**Status**: technical design in [technical.md](technical.md)

## Context

kurotako is validated so far only through unit and e2e tests inside each package
(`packages/*`). There is no place in the repo that exercises the full pipeline —
Prisma schema → `tako generate` → generated Zod schemas → generated Angular reactive
forms — against a realistic consumer setup: a real NestJS backend and a real Angular
frontend, wired together the way a real project would use kurotako.

Without this, regressions that only show up when the generated code is actually
compiled and run by a consumer app (NestJS controller using a generated Zod schema
for request validation, Angular component using a generated reactive/signal form) can
go unnoticed until a real user hits them.

## Goal

Add an `examples/` directory at the repo root holding multiple self-contained example
monorepos, each combining a supported parser version with the supported generators, so
that:

- every supported version combination kurotako claims to support has a project that
  actually builds and runs against it;
- the generated Zod schemas are consumed for real on both sides — NestJS request
  validation and Angular form validation — not just asserted against snapshots;
  the Angular side also fetches data from a NestJS endpoint, binds it into the
  generated form, and submits back to the API;
- new parser/generator version combinations are added as new example projects over
  time, growing the support matrix incrementally.

Starting scope (two example projects, both on parser-prisma's only implemented mode —
Prisma 7 DMMF — but differing in kurotako **output mode**, so both output-modes are
exercised end to end):

- `examples/nestjs11-prisma7-angular22-outputdir` — output mode A (`dir`): generated
  code duplicated per app (`apps/backend/generated/kurotako`,
  `apps/frontend/generated/kurotako`).
- `examples/nestjs11-prisma7-angular22-outputpkg` — output mode B (`package`):
  generated code as one shared workspace package
  (`packages/generated-<ns>`), consumed by both apps via `workspace:*`.

A third example project (another Prisma version, or the `contract.json` mode once
implemented) is deferred: `@kurotako/parser-prisma`'s `version: 8` mode is not
implemented yet (`packages/parser-prisma/src/parser.ts` throws
`'the Prisma 8 contract.json mode is not implemented in kurotako v1'`), and the
supported Prisma npm range is `>=5 <8` (peer dependency in
`packages/parser-prisma/package.json`) — an example targeting real Prisma 8 would not
run. Added later once another supported combination exists.

Both projects share the same Prisma schema domain (a small task-manager: `User` /
`Project` / `Task`, with a 1-N and an optional relation, to exercise both flat and
deep relation rendering). Each project gets its own small Prisma schema, its own
`tako.config.ts`, generates Zod validators + Angular reactive/signal forms, and uses
that generated code on both the NestJS side (request validation) and the Angular side
(fetch → form → validate → submit to the API).

## Decisions already made

- Example projects stay in this repo, under `examples/<project>/`, one directory per
  monorepo — no dedicated separate repo.
- Each `examples/<project>/` is **fully standalone**: its own `package.json`, its own
  lockfile, its own dependency graph. It is **not** part of the root Bun workspace
  (`packages/*`, `apps/*`) and the root `package.json` must not reference it in any way
  (no `workspaces` entry, no root script assuming its presence). Each project manages
  itself entirely — install, build, generate, run — independently of the rest of the
  repo, the way a real consumer project would.
- kurotako packages are consumed by each example the same way a real external consumer
  would: an ordinary semver `dependency`/`devDependency` entry (`"@kurotako/cli":
  "^0.0.0"`, etc.) in the example's `package.json`, resolved from the npm registry once
  published. For local development/testing before publication, `bun link` is used to
  point that dependency at the locally built package — the example's own manifest
  never encodes a `file:`/`workspace:*` reference to the kurotako repo.
- Each example project is itself a small Bun monorepo, structured the same way as the
  kurotako repo itself (`package.json` with Bun `workspaces`, own lockfile, own
  `tsconfig.json`/`biome.json` as needed) — entirely self-contained, no tie to the root
  workspace.
- No dedicated CI for these example projects. They are dev-only fixtures, run and
  checked manually — no GitHub Actions workflow for now.
- Naming convention for `examples/<project>/`:
  `<backend>-<version>-<parser>-<version>-<frontend>-<version>` (already applied by
  the two starting projects, e.g. `nestjs11-prisma7-angular22`). Future combinations
  follow the same pattern as the support matrix grows.

## Open questions

- Relationship to [monorepo-projects](../monorepo-projects/overview.md): that feature
  is about making `tako` itself work correctly when run from a consumer monorepo root
  (dependency resolution, multi-source/multi-output). This feature is about having
  fixture projects to exercise and prove that behavior (and everything else) end to
  end. The two are complementary, not overlapping — `monorepo-projects` may end up
  using `examples/` fixtures once they exist.
