# Ops — create the npm org and wire `NPM_TOKEN`

**Status**: done **Type**: ops (manual, user-side) **Issue**: [#101](https://github.com/marmotz/kurotako/issues/101)
Reference: [../features/alpha-release/technical.md §4](../features/alpha-release/technical.md#4-npm-org--token-manual-user-side--prerequisites).

## Verified findings

- `.changeset/config.json` `access: "public"`; every `packages/*/package.json` repeats
  `publishConfig.access = "public"`.
- `release.yml` env references `NPM_TOKEN` (`${{ secrets.NPM_TOKEN }}`); no such repo
  secret exists yet.
- Scope `@kurotako/*` on 7 packages plus the unscoped `kurotako`.

## To do

1. Create the npm organisation **`kurotako`** (owns the `@kurotako` scope).
2. Confirm the unscoped package name **`kurotako`** is available (or claimed by this
   account).
3. Create a **granular automation token** scoped to publish the 8 packages (`kurotako`,
   `@kurotako/ir|core|config|cli|gen-zod|gen-angular|parser-prisma`).
4. Add it as the GitHub repo secret **`NPM_TOKEN`** (Settings → Secrets and variables →
   Actions).
5. No code change. Close the issue once the secret is set.

## Dependencies

None. Pure account/repo configuration; done by the maintainer.
