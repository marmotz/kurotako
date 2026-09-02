# CI — changesets (independent versioning)

**Status**: to do **Type**: CI **Issue**: [#8](https://github.com/marmotz/kurotako/issues/8)

Reference: [../features/monorepo-bootstrap/technical.md §Versioning / publishing — changesets](../features/monorepo-bootstrap/technical.md#versioning--publishing--changesets).

## To do

1. Create `.changeset/config.json`: `changelog` `@changesets/cli/changelog`,
   `commit: false`, `access: public`, `baseBranch: main` (to adjust if the repo's default branch is `develop` at
   creation), `updateInternalDependencies: patch`,
   `linked: []`, `fixed: []` (**independent** versioning).
2. Add `@changesets/cli` as a root devDependency.
3. Wire the root `release` script = `changeset publish`.
4. All packages stay at `0.0.0` / `0.x` until the MVP works end to end.
5. The release workflow (`changeset version` → PR, `changeset publish` on merge) is written
   in the CI task but left disabled until the MVP packages leave `0.0.0`.

## Dependencies

- [#6](6-package-skeletons.md)
