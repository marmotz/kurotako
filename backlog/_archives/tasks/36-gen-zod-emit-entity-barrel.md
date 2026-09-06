# backend — @kurotako/gen-zod per-entity schema file and namespace barrel

**Status**: done **Type**: backend **Issue**: [#36](https://github.com/marmotz/kurotako/issues/36)

Reference: [../features/generator-zod/technical.md §File layout (decided: one file per entity + shared enums file)](../features/generator-zod/technical.md#file-layout-decided-one-file-per-entity--shared-enums-file),
[§Naming (`names.ts`)](../features/generator-zod/technical.md#naming-namests--deterministic-never-namespace-prefixed),
[§Determinism](../features/generator-zod/technical.md#determinism).

## Verified

- A generator owns the `<namespace>/zod/` prefix on every `VirtualFile.path`; paths are
  POSIX ([output-modes/technical.md](../features/output-modes/technical.md) amendment — one
  sub-tree per generator, core synthesizes `<ns>/index.ts`). `emitBarrel` produces
  `<ns>/zod/index.ts` (this generator's own barrel), not `<ns>/index.ts`.
- `iterEntities` / `iterFields` preserve IR key order (determinism requirement).

## To do

1. `packages/gen-zod/src/emit/entity.ts`:
   `emitEntity(ir, source, entity, dialect): string` — assemble one
   `<ns>/<entity>.schema.ts`:
   - sorted `import` block (`zod`, `./enums`, `./filters`, sibling `./<other>.schema`);
   - for each of the 5 variants × 2 families: `export const <Name>Schema = z.object({ ... })`
     (or `.partial()` / `z.lazy(...)` per variant), composing `fieldExpr` +
     `relationExpr`;
   - `export type <Name>Dto = z.infer<typeof <Name>Schema>` for each.
2. `packages/gen-zod/src/emit/barrel.ts`:
   `emitBarrel(source): string` — `export * from './enums'`, `'./filters'`, and every
   `'./<entity>.schema'`. Emitted at `<ns>/zod/index.ts`. Empty source → still a valid
   `index.ts`.
3. `packages/gen-zod/src/emit/*.test.ts`:
   - flat entity file contains no `z.lazy`; deep references sibling `<Target>DeepSchema`
     via `z.lazy`;
   - every variant/family export + its `Dto` type present; import lines sorted;
   - barrel re-exports all files; zero-entity source → bare `index.ts`.
4. `bun run typecheck`, `bun run test`, `bun run build` green.

## Dependencies

- [34-gen-zod-variants-relations](34-gen-zod-variants-relations.md)
- [35-gen-zod-emit-enums-filters](35-gen-zod-emit-enums-filters.md)
