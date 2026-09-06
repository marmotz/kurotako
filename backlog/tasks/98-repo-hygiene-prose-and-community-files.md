# Docs — refresh stale prose and add community-health files

**Status**: done **Type**: docs **Issue**: [#98](https://github.com/marmotz/kurotako/issues/98)
Reference: [../features/alpha-release/technical.md §7](../features/alpha-release/technical.md#7-readme-changelog-docs-prose)
and [§8](../features/alpha-release/technical.md#8-securitymd--github-templates).

## Verified findings

- `README.md` still carries "Status: design phase" and "The seven packages are
  scaffolded empty (a single exported `version` const and one trivial test each)".
- Root `AGENTS.md` "Project status" says "No implementation code exists yet — no
  `package.json`, no `src/`, no tooling"; "Planned toolchain (not yet in place)"; "The
  GitHub repo `marmotz/kurotako` exists and holds the backlog issues".
- `CONTRIBUTING.md` toolchain table says "TypeScript | 7.x in-repo, 5.5 consumer floor";
  root `package.json` pins `typescript@5.9.3` (staying on 5.x is deliberate).
- `docs/vision.md:67` refers to "the design phase".
- No `SECURITY.md`, no `.github/ISSUE_TEMPLATE/`, no `.github/PULL_REQUEST_TEMPLATE.md`.

## To do

1. `README.md`: remove the "design phase" admonition; add an **Install**
   (`npm i -D kurotako`, `bunx tako init`) and a short **Quickstart** section against
   the published `0.1.0`; keep one line "`0.x`: the public API may change between minor
   versions"; keep the docs link to <https://kurotako.marmotz.dev/>.
2. Root `AGENTS.md`: rewrite "Project status" (MVP implemented, `0.1.0` on npm, repo
   public, code under `packages/` + `apps/`); retitle "Planned toolchain (not yet in
   place)" → "Toolchain" and drop the "not yet" framing; fix the "holds the backlog
   issues" sentence.
3. `CONTRIBUTING.md`: correct the TypeScript row to `5.9.3` in-repo / `5.5` consumer
   floor; re-check every other row against the real `devDependencies`.
4. `docs/vision.md`: adjust the `:67` "design phase" wording to past tense. Keep this
   minimal — the broader docs reconciliation is issue #60's scope.
5. Add `SECURITY.md`: supported versions (`0.x` only), reporting channel (GitHub private
   security advisory), no bounty.
6. Add `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`,
   `.github/ISSUE_TEMPLATE/config.yml` (links to docs + Discussions).
7. Add `.github/PULL_REQUEST_TEMPLATE.md`: checklist — tests pass, changeset added if
   user-facing, everything in English, docs updated.

## Dependencies

None.
