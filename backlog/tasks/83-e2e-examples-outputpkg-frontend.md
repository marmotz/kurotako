# examples/nestjs11-prisma7-angular22-outputpkg — Angular frontend

**Statut** : fait
**Type** : front
**Issue** : [#83](https://github.com/marmotz/kurotako/issues/83)

Référence : [../features/e2e-examples/technical.md §Angular frontend (apps/frontend)](../features/e2e-examples/technical.md#angular-frontend-appsfrontend).

## Constat vérifié

- Same shape as #81 — [81-e2e-examples-outputdir-frontend](81-e2e-examples-outputdir-frontend.md), except imports come from the workspace package `@example/tasks`.
- `relations: 'deep'` in this project's `tako.config.ts` — the generated `Task` form nests a `FormGroup` for `project` (required) and a lazily-built one for `assignee` (optional), instead of flat FK scalars ([../features/e2e-examples/technical.md §Directory layout — …-outputpkg/](../features/e2e-examples/technical.md#directory-layout--outputpkg-mode-b)).

## À faire

1. `TasksApiService`, `TaskListComponent` — same as #81 — [81-e2e-examples-outputdir-frontend](81-e2e-examples-outputdir-frontend.md) steps 1-2, imports from `@example/tasks` instead of a relative path.
2. `TaskCreateFormComponent` (reactive factory) and `TaskEditFormComponent` (signal factory) — same flow as the outputdir project, but this time exercising the **nested** `project`/`assignee` form groups produced by `relations: 'deep'` instead of flat scalar controls.
3. Wire the three components into a minimal `AppComponent`/routes.
4. Manual verification: same as #81 step 6, additionally confirming the nested relation controls render and validate correctly (e.g. selecting a project populates the nested group, clearing the optional assignee group is allowed).

## Dépendances

Depends on #79 — [79-e2e-examples-outputpkg-scaffold](79-e2e-examples-outputpkg-scaffold.md). Manual end-to-end verification also needs #82 — [82-e2e-examples-outputpkg-backend](82-e2e-examples-outputpkg-backend.md) running, but that is not a build-time dependency.
