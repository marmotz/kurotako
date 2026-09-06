# Release — dry-run, publish 0.1.0, verify per-package tags and Releases

**Status**: to do **Type**: release **Issue**: [#104](https://github.com/marmotz/kurotako/issues/104)
Reference: [../features/alpha-release/technical.md §Design](../features/alpha-release/technical.md#design)
and [§Consequences verified against current code](../features/alpha-release/technical.md#consequences-verified-against-current-code).

## Verified findings

- Once versioned to `0.1.0`, publishing goes through `release.yml`
  (`workflow_dispatch`), `bunx changeset publish`.
- `ci.yml` runs the `--version` smoke checks on every push/PR; the "Version Packages"
  state must be green before this task.

## To do

1. From a clean checkout on `develop` at the `0.1.0` commit: `bun install --frozen-lockfile`,
   `bun run build`, `bunx changeset publish --dry-run`. Inspect each tarball
   (`npm pack --dry-run` per package or the changesets output):
   - `workspace:^` rewritten to `^0.1.0` in `dependencies` and `peerDependencies`;
   - `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json` present;
   - `bin` paths (`dist/bin/tako.js`) resolve for `@kurotako/cli` and `kurotako`.
2. Trigger `release.yml` via `workflow_dispatch`. If it opens a "Version Packages" PR
   (no changeset was left), there is nothing to version — re-run after confirming
   `package.json` files already read `0.1.0`; the publish path runs when no changesets
   are pending.
3. Confirm all 8 packages are live on npm at `0.1.0` under the `latest` tag, with a
   provenance badge.
4. Confirm the release workflow created the artifacts it owns: one `pkg@0.1.0` git tag
   per published package and one GitHub Release per package (`changeset publish` +
   `changesets/action` `createGithubReleases`). No umbrella `v0.1.0` tag and no
   repo-wide Release — versions are independent. Edit the 8 Release notes to link the
   archived features (`backlog/_archives/done.md`) if the generated notes are too thin.
5. Smoke test from a scratch directory: `npm i -D kurotako@0.1.0`, `bunx tako init`,
   `bunx tako generate` on a tiny Prisma schema — or run the existing
   `apps`/`examples` e2e against the published package if simpler.

## Dependencies

- [#102](102-release-workflow-enable.md)
- [#101](101-npm-org-and-token.md)
- [#103](103-consolidate-changesets-version-010.md)
