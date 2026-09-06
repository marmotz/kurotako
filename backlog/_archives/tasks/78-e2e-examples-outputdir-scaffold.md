# examples/nestjs11-prisma7-angular22-outputdir — scaffold

**Statut** : fait
**Type** : chore
**Issue** : [#78](https://github.com/marmotz/kurotako/issues/78)

Référence : [../features/e2e-examples/technical.md §Directory layout — …-outputdir/ (mode A)](../features/e2e-examples/technical.md#directory-layout--outputdir-mode-a).

## Constat vérifié

- `examples/` does not exist yet in this repo.
- `PrismaParserOptions` ([../../packages/parser-prisma/src/options.ts:13-16](../../../packages/parser-prisma/src/options.ts)): `{ schema?: string, version?: 7 | 8 }`.
- `ZodGeneratorOptions` ([../../packages/gen-zod/src/options.ts:11-13](../../../packages/gen-zod/src/options.ts)): `{ zodVersion?: 3 | 4 }`.
- `AngularGeneratorOptions` ([../../packages/gen-angular/src/options.ts:8-16](../../../packages/gen-angular/src/options.ts)): `{ forms?: ('reactive'|'signal')[], relations?: 'flat'|'deep' }`.
- `defineConfig`/`defineParser`/`defineGenerator` from `@kurotako/config` ([../../packages/config/src/define-driver.ts:19-53](../../../packages/config/src/define-driver.ts)).
- `OutputOption.generators?: string[]` restricts a destination to a subset of `generators[]`, omitted = all ([../features/output-modes/technical.md §Multiple outputs](../features/output-modes/technical.md)).
- All kurotako packages are pinned at `0.0.0` today ([../../packages/cli/package.json:3](../../../packages/cli/package.json)).

## À faire

1. Create `examples/nestjs11-prisma7-angular22-outputdir/` as its own Bun workspace: `package.json` (`private: true`, `workspaces: ["apps/*"]`, own `bun.lock`), `biome.json` (or no linting — project's own call, independent of root), `tsconfig.base.json`.
2. `devDependencies`: `"@kurotako/cli": "0.0.0"`, `"@kurotako/parser-prisma": "0.0.0"`, `"@kurotako/gen-zod": "0.0.0"`, `"@kurotako/gen-angular": "0.0.0"` — resolved locally via `bun link` (documented in step 5, not encoded here).
3. Scaffold `apps/backend/` (NestJS 11, via `nest new` conventions) and `apps/frontend/` (Angular 22, via `ng new` conventions) as empty-but-runnable apps — no domain code yet (that's the backend/frontend tasks).
4. Write `apps/backend/prisma/schema.prisma` with the shared `User`/`Project`/`Task` schema from [../features/e2e-examples/technical.md §Prisma schema (shared domain)](../features/e2e-examples/technical.md#prisma-schema-shared-domain) (SQLite datasource, `prisma-client-js` generator).
5. Write `tako.config.ts` at the project root exactly as specified in [technical.md §Directory layout — …-outputdir/](../features/e2e-examples/technical.md#directory-layout--outputdir-mode-a): one source (`tasks`, `version: 7`), `zodGenerator({ zodVersion: 4 })` + `angularGenerator({ forms: ['reactive', 'signal'], relations: 'flat' })`, two `outputs[]` entries (`apps/backend/generated/kurotako` restricted to `generators: ['zod']`, `apps/frontend/generated/kurotako` unrestricted).
6. Write `README.md`: the `bun link` setup sequence from [technical.md §Consuming kurotako packages](../features/e2e-examples/technical.md#consuming-kurotako-packages-both-projects), plus `bunx prisma generate`, `bunx prisma migrate dev`, `bunx tako generate`, and per-app run commands.
7. Verify end to end: `bun install`, link the four kurotako packages, `tako generate` succeeds and produces `apps/backend/generated/kurotako/tasks/zod/…` and `apps/frontend/generated/kurotako/tasks/{zod,angular}/…`.

## Dépendances

Depends on #77 — [77-e2e-examples-root-tooling](77-e2e-examples-root-tooling.md) (`.gitignore` entries should be in place before `tako generate`/`prisma generate` output exists locally, to avoid accidentally committing it).
