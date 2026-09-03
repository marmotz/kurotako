# backend — @kurotako/config structural Valibot schema

**Status**: done
**Type**: backend
**Issue**: [#23](https://github.com/marmotz/kurotako/issues/23)

Reference: [../features/config-system/technical.md §Structural validation (`schema.ts`)](../features/config-system/technical.md#structural-validation-schemats).

## Verified

- Decided (technical.md §Not schema-first): the config is **not** schema-first — the TS
  types are hand-authored (their task), and this Valibot schema validates only the
  **structural** part, for JS / hand-edited / programmatic configs and to produce located
  messages.
- `NAMESPACE_RE` is pinned here and referenced by
  [output-modes](../features/output-modes/overview.md).

## To do

1. `packages/config/src/schema.ts`:
   - `export const NAMESPACE_RE = /^[a-z][a-zA-Z0-9]*$/` ([ADR-0005](https://github.com/marmotz/kurotako/blob/main/docs/adr/0005-output-modes.md)).
   - `DriverObject` — `v.object({ name: v.pipe(v.string(), v.minLength(1)) })` plus a
     `v.check` that `parse` or `generate` is a function.
   - `export const TakoConfigSchema` — exactly the shape in technical.md §schema.ts:
     `sources` non-empty record keyed by `NAMESPACE_RE`, `generators` array,
     `output?` object (`dir?`, `mode?` picklist `['dir','package']`, `packagesDir?`,
     `scope?`, `packageManager?` picklist `['bun','pnpm','yarn','npm']`), `hooks?` object
     with `afterEmit?` checked as `undefined | function`.
     Driver `options` stay `v.optional(v.unknown())` (validated per driver elsewhere).
   - A helper `normalizeIssues(issues): { path: string; message: string }[]` turning
     Valibot issues into dotted-path form (e.g. `generators.0.use`), reused by `load.ts`
     when throwing `ConfigShapeError`.
2. Add `schema.ts` exports to the `index.ts` barrel (`TakoConfigSchema`, `NAMESPACE_RE`).
3. `packages/config/src/schema.test.ts`:
   - a minimal valid config passes;
   - empty `sources` fails;
   - a bad namespace key (`'1pg'`, `'Pg'`) fails with a located path;
   - `output.mode: 'package'` alone still passes the structural schema (the `packagesDir`
     **and `scope`** requirement is a cross-field check in `load.ts` — assert it is *not*
     caught here);
   - `output.packageManager: 'deno'` fails the picklist;
   - `hooks.afterEmit: 42` fails;
   - `normalizeIssues` produces dotted paths.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [22-config-types-and-errors](22-config-types-and-errors.md)
