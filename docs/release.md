# Releases

This document describes how the `@kurotako/*` packages and the `kurotako` meta
package are versioned and published to npm.

## Overview

Packages use independent [Changesets](https://github.com/changesets/changesets)
versioning. A release has two distinct phases:

1. Changesets are turned into package-version and changelog changes in a
   `Version Packages` pull request.
2. Once that pull request is merged, the same GitHub Actions workflow publishes
   the new versions to npm, creates tags, and creates GitHub Releases.

The publishing workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml).
It uses npm trusted publishing (GitHub Actions OIDC); no `NPM_TOKEN` is stored in
this repository.

## Adding a changeset

Create a changeset for every user-facing change to a published package:

```bash
bunx changeset
```

Select each affected package, choose the appropriate bump, write a concise
English release note, and commit the generated file in `.changeset/` with the
implementation.

For packages below `1.0.0`, use a `minor` bump for a new public capability and a
`patch` bump for a backwards-compatible fix. Do not add a changeset for changes
with no user-facing effect, such as documentation-only changes or an internal
refactor.

Changesets calculate dependency updates when needed. Do not edit package
versions or changelogs by hand.

## Releasing existing packages

Before starting, ensure the target commit is on `develop`, CI is green, and the
release changesets have been merged.

1. Open **Actions** in GitHub, select **Release**, select the `develop` branch,
   and click **Run workflow**.
2. The first run creates or refreshes the `Version Packages` pull request. It
   consumes the changesets, updates the affected `package.json` files, and
   writes their changelogs. It does not publish anything.
3. Review and merge that pull request into `develop`.
4. Run **Release** again on the merged `develop` commit. With no changesets
   remaining, it builds the workspace and publishes the versions missing from
   npm.
5. Confirm the npm package pages, git tags, and GitHub Releases.

Each package must already be configured on npm for trusted publishing. The
workflow uses:

- GitHub organization: `marmotz`
- repository: `kurotako`
- workflow filename: `release.yml`

## Publishing a new package for the first time

npm cannot use OIDC trusted publishing until a package exists on npm. Its first
publication must therefore be performed locally by a maintainer with npm publish
rights and 2FA enabled.

Follow the normal versioning phase first: run **Release** once, review and merge
the `Version Packages` pull request, then update the local checkout to that
merged `develop` commit.

```bash
git pull origin develop
npm login
RELEASE_PUSH=1 bun run release
```

`npm login` is interactive and may request a 2FA code. `bun run release` builds
the packages, packs them with Bun (so `workspace:` dependencies are converted to
published versions), and uploads the tarballs with npm. `RELEASE_PUSH=1` also
pushes the generated tags and creates GitHub Releases.

The script skips package versions that already exist on npm, so it is safe to
use for this bootstrap release. Do not run `changeset publish`: it uses Bun's
publisher, which cannot authenticate with npm OIDC.

Immediately after the first publication, configure npm trusted publishing for
the new package:

1. Open the package on npmjs.com, then **Settings** → **Trusted publishing**.
2. Choose **GitHub Actions**.
3. Enter `marmotz` as the organization, `kurotako` as the repository, and
   `release.yml` as the workflow filename (only the filename, including `.yml`).
4. Allow direct `npm publish` and save the configuration.

Future releases of that package then use the standard GitHub Actions process.

## Troubleshooting and recovery

### The workflow cannot create the version pull request

If GitHub reports that Actions cannot create pull requests, enable **Allow
GitHub Actions to create and approve pull requests** under **Settings** →
**Actions** → **General** → **Workflow permissions**. The workflow may already
have pushed `changeset-release/develop`; in that case, create the pull request
from that branch to `develop` manually.

### npm fails with `ENEEDAUTH`

For a GitHub-hosted runner, this normally means that trusted publishing is not
configured for that exact package, or the npm configuration does not exactly
match `marmotz`, `kurotako`, and `release.yml`. Add or correct the trusted
publisher, ensure direct `npm publish` is allowed, then rerun **Release**.

### A run publishes packages and then fails

The publish script skips versions that npm already has, so a rerun can resume
the remaining publications safely. However, tags created earlier in the failed
GitHub runner do not survive unless the runner reached the tag-push step. After
the retry, compare npm versions with git tags and GitHub Releases; recreate and
push any missing tags/releases before considering the release complete.
