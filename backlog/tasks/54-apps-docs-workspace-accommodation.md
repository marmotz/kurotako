# CI — apps/docs workspace accommodation

**Status**: done **Type**: CI **Issue**: [#54](https://github.com/marmotz/kurotako/issues/54)

Reference: [../features/docs-site/technical.md §Amendments to monorepo-bootstrap](../features/docs-site/technical.md#amendments-to-monorepo-bootstrap)
and [../features/monorepo-bootstrap/technical.md §Consequences](../features/monorepo-bootstrap/technical.md#consequences-verified-against-the-current-repo).

## Verified state

The bootstrap scaffold tasks ([#1](1-root-workspace-scaffold.md),
[#5](5-biome-lint-format.md), [#8](8-changesets-release.md),
[#10](10-repo-meta-files.md)) target `packages/*` only. The documentation site
([docs-site/technical.md](../features/docs-site/technical.md)) introduces a second
workspace root `apps/docs` (`@kurotako/docs`, `"private": true`, Docusaurus, never
published, deliberately outside `tsc -b`). The root files created by those tasks need a
few additive edits to make room for it. This task carries only those root-file edits; the
site package itself (`apps/docs/**`, `docusaurus.config.ts`, TypeDoc wiring, `docs.yml`
workflow) is a docs-site deliverable, not part of this task.

## To do

1. Root `package.json`: extend `"workspaces"` from `["packages/*"]` to
   `["packages/*", "apps/*"]`.
2. Root `.gitignore`: add `apps/docs/build`, `apps/docs/.docusaurus`,
   `apps/docs/docs/api` (the generated TypeDoc output on the `next` version; frozen
   copies under `apps/docs/versioned_docs/` stay committed).
3. `biome.json`: exclude `apps/docs/build`, `apps/docs/.docusaurus`,
   `apps/docs/docs/api`, `apps/docs/versioned_docs` from `files.includes` (generated /
   vendored Markdown and build output must not be linted or formatted).
4. `.changeset/config.json`: add `@kurotako/docs` to `ignore` (belt-and-braces — it is
   already excluded from publish by `"private": true` and by living outside
   `packages/*`).
5. `CONTRIBUTING.md`: document (a) the local docs dev loop
   `bun run --filter '@kurotako/docs' start`, and (b) the release step
   `bun run --filter '@kurotako/docs' docusaurus docs:version <major.minor>` to cut a
   frozen docs version on a `@kurotako/cli` release, committing `versioned_docs/`,
   `versioned_sidebars/` and `versions.json`.
6. Do **not** add `apps/docs` to the root solution `tsconfig.json` `references` — it is
   not a composite project. Leave a one-line comment near the references list if it
   helps a future contributor not "fix" this.
7. `vitest.workspace.ts` needs no change — the glob is `packages/*/vitest.config.ts` and
   the site has no unit tests.

## Dependencies

- [#1](1-root-workspace-scaffold.md) — root `package.json`, `.gitignore`.
- [#5](5-biome-lint-format.md) — `biome.json`.
- [#8](8-changesets-release.md) — `.changeset/config.json`.
- [#10](10-repo-meta-files.md) — `CONTRIBUTING.md`.
