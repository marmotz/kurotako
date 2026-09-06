# examples/nestjs11-prisma7-angular22-outputpkg — scaffold

**Statut** : fait
**Type** : chore
**Issue** : [#79](https://github.com/marmotz/kurotako/issues/79)

Référence : [../features/e2e-examples/technical.md §Directory layout — …-outputpkg/ (mode B)](../features/e2e-examples/technical.md#directory-layout--outputpkg-mode-b).

## Constat vérifié

- Same driver option shapes as the outputdir scaffold task (`PrismaParserOptions`, `ZodGeneratorOptions`, `AngularGeneratorOptions`, `defineConfig`).
- Mode-B `packageWriter` produces `<packagesDir>/<scope-without-@>-<ns>/` with `package.json.name = "<scope>/<ns>"` ([../features/output-modes/technical.md §packageWriter](../features/output-modes/technical.md)) — here `packages/example-tasks/`, name `@example/tasks`.

## À faire

1. Create `examples/nestjs11-prisma7-angular22-outputpkg/` as its own Bun workspace: `package.json` (`private: true`, `workspaces: ["apps/*", "packages/*"]` — `packages/*` is required so the mode-B generated package resolves as a workspace member, own `bun.lock`), `biome.json`, `tsconfig.base.json`.
2. `devDependencies` on the four kurotako packages at `0.0.0`, same as #78 — [78-e2e-examples-outputdir-scaffold](78-e2e-examples-outputdir-scaffold.md) step 2.
3. Scaffold `apps/backend/` (NestJS 11) and `apps/frontend/` (Angular 22) as empty-but-runnable apps.
4. Write `apps/backend/prisma/schema.prisma` — same shared schema as the outputdir project ([../features/e2e-examples/technical.md §Prisma schema (shared domain)](../features/e2e-examples/technical.md#prisma-schema-shared-domain)).
5. Write `tako.config.ts` exactly as specified in [technical.md §Directory layout — …-outputpkg/](../features/e2e-examples/technical.md#directory-layout--outputpkg-mode-b): one source (`tasks`, `version: 7`), `zodGenerator({ zodVersion: 4 })` + `angularGenerator({ forms: ['reactive', 'signal'], relations: 'deep' })`, one `outputs[]` entry (`mode: 'package'`, `packagesDir: './packages'`, `scope: '@example'`, `packageManager: 'bun'`).
6. Both `apps/backend/package.json` and `apps/frontend/package.json` declare `"@example/tasks": "workspace:*"`.
7. Write `README.md`: same `bun link` setup sequence as the outputdir project, plus `bunx prisma generate`, `bunx prisma migrate dev`, `bunx tako generate`, `bun install` (to link the freshly generated `packages/example-tasks` workspace member), then per-app run commands.
8. Verify end to end: `tako generate` produces `packages/example-tasks/` with a valid `package.json`, builds via its own `tsup` step (mode B), and `bun install` links it into both apps' `node_modules`.

## Dépendances

Depends on #77 — [77-e2e-examples-root-tooling](77-e2e-examples-root-tooling.md).
