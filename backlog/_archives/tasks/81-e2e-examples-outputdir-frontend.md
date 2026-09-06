# examples/nestjs11-prisma7-angular22-outputdir — Angular frontend

**Statut** : fait
**Type** : front
**Issue** : [#81](https://github.com/marmotz/kurotako/issues/81)

Référence : [../features/e2e-examples/technical.md §Angular frontend (apps/frontend)](../features/e2e-examples/technical.md#angular-frontend-appsfrontend).

## Constat vérifié

- The scaffold task produces `apps/frontend/generated/kurotako/tasks/{zod,angular}/…` (unrestricted destination — both generators).
- `AngularGeneratorOptions.forms` is `['reactive', 'signal']` in this project's `tako.config.ts` — both a reactive `FormGroup` factory and a signal-based form factory are emitted per entity ([../features/generator-angular/technical.md](../features/generator-angular/technical.md)).
- `relations: 'flat'` in this project — generated forms expose FK scalars (`projectId`, `assigneeId`), not nested groups.

## À faire

1. `TasksApiService` (`HttpClient`) — `getTasks()` / `createTask()` against the NestJS backend's `GET|POST /tasks`.
2. `TaskListComponent` — standalone component, signals-based fetch (`resource`/`httpResource` over `TasksApiService`), renders the list.
3. `TaskCreateFormComponent` — uses the generated **reactive** factory (`createTaskCreateForm(): FormGroup<...>`) from `../../generated/kurotako`; validates with the generated `TaskCreateSchema.parse()` before calling `TasksApiService.createTask()`; maps Zod issues to Angular form errors on failure.
4. `TaskEditFormComponent` — same flow, but built on the generated **signal** form factory instead, side by side with the reactive component to demonstrate both APIs.
5. Wire the three components into a minimal `AppComponent`/routes so all three are reachable manually.
6. Manual verification: run the Angular dev server against the NestJS backend (both from the outputdir-backend task), confirm fetch/list, valid submit (succeeds), invalid submit (rejected client-side, form shows errors, no request sent).

## Dépendances

Depends on #78 — [78-e2e-examples-outputdir-scaffold](78-e2e-examples-outputdir-scaffold.md). Manual end-to-end verification (step 6) also needs #80 — [80-e2e-examples-outputdir-backend](80-e2e-examples-outputdir-backend.md) running, but that is not a build-time dependency.
