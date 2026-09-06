# Backlog — tracking

Each feature goes through `backlog-discuss` then `backlog-technical` before `backlog-tasks`.
GitHub issues live on `marmotz/kurotako` (see [AGENTS.md](AGENTS.md)). Completed features
are archived in [`_archives/done.md`](_archives/done.md).

## First public release (0.1.0)

[features/alpha-release/overview.md](features/alpha-release/overview.md) — publish
`kurotako` + `@kurotako/*` to npm as a plain `0.1.0` under `latest`: package metadata,
npm org + `NPM_TOKEN`, single initial changeset, `workspace:^` migration, refreshed
README. Docs site and public repo are already done. Technical design:
[technical.md](features/alpha-release/technical.md).

| Done | Issue | Task | Description |
|------|-------|------|-------------|
| [x] | [#98](https://github.com/marmotz/kurotako/issues/98) | [98-repo-hygiene-prose-and-community-files](tasks/98-repo-hygiene-prose-and-community-files.md) | Refresh README / AGENTS.md / CONTRIBUTING.md / vision.md; add SECURITY.md + issue/PR templates |
| [x] | [#99](https://github.com/marmotz/kurotako/issues/99) | [99-package-metadata-and-readmes](tasks/99-package-metadata-and-readmes.md) | `description` / `keywords` / `repository` / `homepage` / `bugs` in the 8 `package.json`; per-package `README.md` |
| [x] | [#100](https://github.com/marmotz/kurotako/issues/100) | [100-internal-deps-workspace-caret](tasks/100-internal-deps-workspace-caret.md) | `workspace:*` → `workspace:^` (27 sites, incl. peer deps); `.changeset` `baseBranch` → `develop` |
| [x] | [#101](https://github.com/marmotz/kurotako/issues/101) | [101-npm-org-and-token](tasks/101-npm-org-and-token.md) | Create the `kurotako` npm org + automation token → repo secret `NPM_TOKEN` (manual) |
| [x] | [#102](https://github.com/marmotz/kurotako/issues/102) | [102-release-workflow-enable](tasks/102-release-workflow-enable.md) | Enable `release.yml` (manual), fix build-before-version order, add npm provenance |
| [x] | [#103](https://github.com/marmotz/kurotako/issues/103) | [103-consolidate-changesets-version-010](tasks/103-consolidate-changesets-version-010.md) | Replace 6 changesets with one; `changeset version` → 0.1.0; per-package + root CHANGELOG |
| [ ] | [#104](https://github.com/marmotz/kurotako/issues/104) | [104-publish-010-tag-release](tasks/104-publish-010-tag-release.md) | OIDC publish pipeline, manual first 0.1.0 publish, per-package tags + GitHub Releases, scratch-project smoke test |
