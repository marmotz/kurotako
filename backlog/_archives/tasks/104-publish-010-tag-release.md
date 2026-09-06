# Release — dry-run, publish 0.1.0, verify per-package tags and Releases

**Status**: done **Type**: release **Issue**: [#104](https://github.com/marmotz/kurotako/issues/104)
Reference: [../features/alpha-release/technical.md §Design](../features/alpha-release/technical.md#design)
and [§Consequences verified against current code](../features/alpha-release/technical.md#consequences-verified-against-current-code).

## Verified findings

- The original `bunx changeset publish` + `NPM_TOKEN` plan was dropped: `bun publish`
  has no npm OIDC support, a classic publish token still triggers `EOTP` in CI, and
  `npm publish` does not rewrite `workspace:`. See technical.md §5 (revised).
- Publish path is now `scripts/release-publish.sh`: `bun pm pack` per package (rewrites
  `workspace:^`) then `npm publish <tarball>` (OIDC in CI, `--provenance`). `release.yml`
  uses `changesets/action` only for the "Version Packages" PR; the publish is a separate
  step gated on `hasChangesets == 'false'`.
- An OIDC trusted publisher cannot be created for a package that does not exist on npm,
  so the first `0.1.0` publish is manual and local; every release after runs in CI.
- `ci.yml` runs the `--version` smoke checks on every push/PR; keep it green.

## To do

1. Dry run: `bun install --frozen-lockfile`, then `RELEASE_DRY_RUN=1 bash scripts/release-publish.sh`.
   Confirm for each of the 8 tarballs:
   - `workspace:^` rewritten to `^0.1.0` in `dependencies` and `peerDependencies`;
   - `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json` present;
   - `bin` paths (`dist/bin/tako.js`) resolve for `@kurotako/cli` and `kurotako`.
   (done for 0.1.0 — all green.)
2. First publish (manual, local, one-time): `npm login` (provides the 2FA OTP), then on
   a clean checkout at the `0.1.0` commit `bun run release`. npm prompts for the OTP per
   package. No provenance badge on `0.1.0` (provenance is CI-only); acceptable.
   Then `git push --tags` if the script could not.
3. Configure a trusted publisher for each of the 8 packages on npmjs.org
   (Settings → Trusted Publisher): org/user `marmotz`, repo `kurotako`, workflow
   `release.yml`. From here on `release.yml` publishes with no secret.
4. Confirm all 8 packages are live on npm at `0.1.0` under the `latest` tag. Provenance
   badge appears from the first CI release onward, not on `0.1.0`.
5. Confirm one `pkg@0.1.0` git tag and one GitHub Release per package (created by the
   script). No umbrella `v0.1.0` tag, no repo-wide Release. Edit the 8 Release notes to
   link the archived features (`backlog/_archives/done.md`) if the generated notes are
   too thin.
6. Smoke test from a scratch directory: `npm i -D kurotako@0.1.0`, `bunx tako init`,
   `bunx tako generate` on a tiny Prisma schema.
7. Backlog follow-up: once `bun publish` gains OIDC support, collapse
   `scripts/release-publish.sh` back into `changeset publish`.

## Dependencies

- [#102](102-release-workflow-enable.md)
- [#101](101-npm-org-and-token.md)
- [#103](103-consolidate-changesets-version-010.md)
