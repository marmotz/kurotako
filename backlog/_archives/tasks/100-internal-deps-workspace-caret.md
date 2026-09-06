# Packages — internal deps to `workspace:^` and fix changesets `baseBranch`

**Status**: done **Type**: packages / CI **Issue**: [#100](https://github.com/marmotz/kurotako/issues/100)
Reference: [../features/alpha-release/technical.md §2](../features/alpha-release/technical.md#2-internal-deps--workspace)
and [§3](../features/alpha-release/technical.md#3-changesetconfigjson--basebranch-develop).

## Verified findings

- `workspace:*` appears 27 times across `packages/*/package.json`, in `dependencies`,
  `devDependencies` and `peerDependencies`.
- `peerDependencies` on `@kurotako/*` with `workspace:*`:
  `@kurotako/config` → `@kurotako/core`; `@kurotako/gen-zod` → `@kurotako/config`,
  `@kurotako/core`; `@kurotako/gen-angular` → `@kurotako/config`, `@kurotako/core`,
  `@kurotako/gen-zod`; `@kurotako/parser-prisma` → `@kurotako/config`, `@kurotako/core`.
- `.changeset/config.json` has `"baseBranch": "main"`; the repo default branch is
  `develop` and `main` does not exist. `updateInternalDependencies: "patch"`.

## To do

1. Replace every `"@kurotako/*": "workspace:*"` with `"workspace:^"` in `dependencies`,
   `devDependencies` and `peerDependencies` of all 8 packages. Leave the external
   `@prisma/internals` peer (`">=5 <8"`, optional) untouched.
2. `.changeset/config.json`: `"baseBranch": "develop"`.
3. `bun install` to refresh `bun.lock`; `bun run typecheck && bun run test && bun run
   build` green.
4. Sanity-check that `bunx changeset status` runs against `develop` without error.

## Dependencies

None.
