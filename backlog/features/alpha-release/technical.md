# First public release (0.1.0) — technical design

Design for [`overview.md`](overview.md). Turns the finished MVP into `0.1.0` on npm.
Product decisions are in `overview.md`; this file is the how, grounded in the current
tree.

## Current state (verified)

| Area | State | Evidence |
|------|-------|----------|
| Package versions | all `0.0.0` | every `packages/*/package.json` `"version": "0.0.0"` |
| Publishable packages | 8 | `packages/{ir,core,config,cli,gen-zod,gen-angular,parser-prisma,kurotako}` |
| Internal dep protocol | `workspace:*` everywhere (27 occurrences), incl. `peerDependencies` | e.g. [`packages/config/package.json`](../../../packages/config/package.json) `peerDependencies["@kurotako/core"] = "workspace:*"` |
| Package metadata | no `description`, `keywords`, `repository`, `homepage`, `bugs`, `license`, `author` in any package; `files: ["dist"]`; no `README.md` in any package | `packages/*/package.json` |
| Release workflow | disabled, `workflow_dispatch` only, no `NPM_TOKEN`, header comment "DISABLED until the MVP packages leave 0.0.0" | [`.github/workflows/release.yml`](../../../.github/workflows/release.yml) |
| Release job order | `bun install` → `bun run build` → `changesets/action` (`version` + `publish`) | `release.yml:24-38` |
| Changesets config | `baseBranch: "main"`, `linked: []`, `fixed: []`, `updateInternalDependencies: "patch"`, `access: "public"`, `ignore: ["@kurotako/docs"]` | [`.changeset/config.json`](../../../.changeset/config.json) |
| Default branch | `develop` (mismatch with `baseBranch`) | `gh repo view` |
| Pending changesets | 6 real, never consumed: `drift-guard-plan`, `ir-model-schemas`, `meta-package-kurotako`, `monorepo-anchor-dir`, `outputs-array`, `tako-init-kurotako-import` | `.changeset/*.md` |
| Version injection | build-time `define` `__TAKO_VERSION__` from `package.json` `version`, in `tsup.config.ts` of `cli` and `kurotako`; runtime fallback `'0.0.0-dev'` / `'0.0.0'` | [`packages/cli/src/cli.ts:18-20`](../../../packages/cli/src/cli.ts), [`packages/cli/tsup.config.ts`](../../../packages/cli/tsup.config.ts), [`packages/kurotako/tsup.config.ts`](../../../packages/kurotako/tsup.config.ts) |
| CI | `ci.yml` on `push develop` + `pull_request`: typecheck, lint, test, build, 4 `--version` smoke checks (Node + Bun, `cli` and `kurotako`); the `kurotako` smoke asserts bin output `==` `package.json` version | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) |
| Docs site | live at <https://kurotako.marmotz.dev/>, deployed by `docs.yml` on push to `develop` (Pages, custom domain, HTTPS approved); TypeDoc over `ir/core/config/cli`; version dropdown hidden until `versions.json` non-empty | [`.github/workflows/docs.yml`](../../../.github/workflows/docs.yml), [`apps/docs/docusaurus.config.ts:52-119`](../../../apps/docs/docusaurus.config.ts) |
| Repo | public, MIT (`LICENSE`, `Copyright (c) 2026 Marmotz`); no `SECURITY.md`, no `.github/ISSUE_TEMPLATE/`, no PR template | `gh`, `ls .github/` |
| Stale prose | `README.md` "Status: design phase" / "packages are scaffolded empty"; root `AGENTS.md` "No implementation code exists yet" / "no `package.json`" / repo "holds the backlog issues"; `CONTRIBUTING.md` "TypeScript 7.x in-repo" (repo pins `typescript@5.9.3`); `docs/vision.md:67` "design phase" wording | files |

## Design

### 1. Reaching `0.1.0` — single changeset + `changeset version`

Delete the 6 pending changesets, add one hand-written
`.changeset/initial-public-release.md`:

```md
---
"@kurotako/ir": minor
"@kurotako/core": minor
"@kurotako/config": minor
"@kurotako/cli": minor
"@kurotako/gen-zod": minor
"@kurotako/gen-angular": minor
"@kurotako/parser-prisma": minor
"kurotako": minor
---

First public release.
```

`bunx changeset version` then takes `0.0.0` → `0.1.0` for all 8 (changesets bumps
`0.0.0` + `minor` to `0.1.0`), writes a `CHANGELOG.md` in each package, and deletes the
changeset. The result is committed on `develop`.

- **Alternative — hand-edit 8 `version` fields.** Rejected: no `CHANGELOG.md`, diverges
  from the tool that every future release uses, and still needs a changeset anyway for
  `release.yml` to have something to publish.
- **Consequence — content of the 6 discarded changesets is not lost:** they describe
  features already merged and documented in `_archives/`; the `0.1.0` line in each
  `CHANGELOG.md` reads "First public release", and the GitHub Release notes can link the
  archived features. Accepted per `overview.md`.

### 2. Internal deps → `workspace:^`

Replace `workspace:*` with `workspace:^` in `dependencies`, `devDependencies` and
`peerDependencies` of every package (27 sites). On publish the package manager rewrites
`workspace:^` to `^0.1.0`; `workspace:*` would rewrite to an exact `0.1.0` pin.

- **Why:** versioning stays independent post-`0.1.0` (`overview.md`). With exact pins,
  any patch of `@kurotako/ir` forces a re-release of `core`, `config`, `cli`,
  `gen-*`, `parser-prisma` and `kurotako`. `^` ranges absorb in-range patches/minors.
- **`peerDependencies` matter most:** `@kurotako/config`, `@kurotako/gen-zod`,
  `@kurotako/gen-angular`, `@kurotako/parser-prisma` declare `@kurotako/*` peers. A
  literal `workspace:*` reaching npm is an unresolvable range for consumers; it must
  become a real caret range.
- **`updateInternalDependencies: "patch"`** (`.changeset/config.json`) keeps working:
  changesets bumps the caret range when an internal dep is released.
- **`@prisma/internals` peer** (`">=5 <8"`, optional) is external and unchanged.

### 3. `.changeset/config.json` — `baseBranch: "develop"`

One-line fix; `main` does not exist. Affects which branch `changeset status` /
`changeset version` diff against.

### 4. npm org + token (manual, user-side — prerequisites)

- Create the npm org **`kurotako`** (owns the `@kurotako/*` scope). `access: "public"`
  is already set in `.changeset/config.json`, and each package repeats
  `publishConfig.access = "public"`.
- The unscoped name **`kurotako`** must be available / claimed on npm.
- Create a **granular automation token** (publish scope, the 8 packages) and add it as
  the repo secret `NPM_TOKEN` (already referenced at `release.yml:38`).

### 5. `release.yml` — keep manual, fix ordering, add provenance

- **Trigger:** stays `workflow_dispatch` only (`overview.md`). Remove the "DISABLED"
  header comment; document that the two-phase changesets flow (dispatch → "Version
  Packages" PR → merge → dispatch again → publish) is intentional for the alpha.
- **Job-order bug:** `bun run build` currently runs *before* `changesets/action`
  (`release.yml:31` vs `:33`). Because `__TAKO_VERSION__` is baked at build time
  (§Current state), a same-run `version` + `build` + `publish` would ship bins stamped
  with the *old* version. Two options, decide at task time:
  - rely on the two-phase flow (build on the post-merge dispatch sees the bumped
    `package.json`) and add a guard, or
  - move `bun run build` to run *after* the `version` step (custom steps instead of the
    action's bundled `version`/`publish`, or a `prepublishOnly` build).
  The `kurotako` CI smoke check (`ci.yml`, bin `==` `package.json` version) will catch a
  mismatch on the release PR.
- **Publish mechanism:** `bunx changeset publish`. changesets 3.x detects `bun`
  (root `packageManager: "bun@1.4.0"`) and shells to `bun publish`, which performs the
  `workspace:` → version rewrite. **Verify in a dry run** (§7); fallback is a
  `prepublish` script that rewrites ranges, or `changeset publish` with an explicit
  publish command.
- **npm provenance** *(recommended)*: add `permissions: id-token: write` and
  `NPM_CONFIG_PROVENANCE: "true"` (or `--provenance`). npm then records a signed,
  publicly verifiable attestation tying each tarball to this exact workflow run and
  commit, shown as a "provenance" badge on npmjs.com. Cost is ~3 lines of YAML since the
  publish already runs in GitHub Actions; requires the publish to stay in CI (it does).
  Drop it only if it blocks the first run.

### 6. Per-package `package.json` metadata

Add to each of the 8:

```jsonc
"description": "<one line>",
"keywords": ["kurotako", "codegen", "typescript", /* + per package: prisma / zod / angular / valibot / cli */],
"license": "MIT",
"author": "Marmotz",
"homepage": "https://kurotako.marmotz.dev/",
"repository": { "type": "git", "url": "git+https://github.com/marmotz/kurotako.git", "directory": "packages/<name>" },
"bugs": "https://github.com/marmotz/kurotako/issues"
```

`files: ["dist"]` stays; npm always includes `README.md` + `LICENSE` + `CHANGELOG.md`
on top of `files`. Confirm during the dry run that `exports`, `main`/`module`/`types`
and the two `bin` entries (`cli`, `kurotako`) resolve inside the tarball.

### 7. README, CHANGELOG, docs prose

- **One `README.md` per published package** (`packages/*/README.md`): what it is, install
  line, minimal usage, link back to <https://kurotako.marmotz.dev/>. `kurotako` and
  `@kurotako/cli` get the fuller getting-started; libraries get a short blurb + docs
  link.
- **`CHANGELOG.md` per package** — generated by `changeset version` (§1),
  `changelog: "@changesets/cli/changelog"` is already configured. Committed.
- **Root `CHANGELOG.md`** — short stub: "per-package changelogs live in
  `packages/*/CHANGELOG.md`; releases are tagged and listed at
  github.com/marmotz/kurotako/releases". changesets does not aggregate a root changelog
  and adding a tool for it is out of scope for `0.1.0`.
- **Root `README.md`** — drop the "design phase" admonition; add an **Install**
  (`npm i -D kurotako` / `bunx tako init`) and **Quickstart** section against the
  published `0.1.0`; keep a one-line "`0.x`: the API may change between minor versions".
- **Root `AGENTS.md`** — rewrite "Project status" (implemented, published `0.1.0`, repo
  public) and "Planned toolchain (not yet in place)" → "Toolchain" (in place). Fix the
  "holds the backlog issues" line.
- **`CONTRIBUTING.md`** — fix the toolchain table: TypeScript is `5.9.3` in-repo, not
  `7.x` (see memory / root `package.json`); re-check the other rows.
- **`docs/vision.md`** — adjust the `:67` "design phase" phrasing to past tense; this is
  the only cross-cutting `docs/` change and stays minimal (the docs-reconciliation task
  #60 owns the rest).
- **Docs site** — no infra work. A short "alpha / `0.x`" note on the landing page.
  `versioned_docs` stay empty (single "current" version per `overview.md`); the version
  dropdown remains hidden.

### 8. `SECURITY.md` + GitHub templates

- `SECURITY.md`: supported versions (`0.x` only), how to report (private advisory /
  email), no bounty.
- `.github/ISSUE_TEMPLATE/`: `bug_report.md`, `feature_request.md`, `config.yml`
  (link to docs + discussions).
- `.github/PULL_REQUEST_TEMPLATE.md`: checklist (tests, changeset, English, docs).

### 9. Branch protection — open

Requiring `ci.yml` to pass before merge to `develop` is proposed but **not decided**
(`overview.md`). It changes the maintainer's own workflow (currently direct pushes to
`develop` are used, e.g. this branch). Left for the user to confirm; if yes it is a
repo-settings change, not code.

## Consequences verified against current code

- **`changeset version` on `0.0.0` + `minor` → `0.1.0`**: standard changesets behavior
  for `0.x`; `patch` would give `0.0.1`. The single all-`minor` changeset yields a clean
  `0.1.0` across the board.
- **Build-time version stamping**: §5 job-order bug is real; `ci.yml`'s `kurotako`
  smoke check is the safety net on the "Version Packages" PR.
- **`bun publish` `workspace:` rewrite**: relied upon by §2; must be confirmed by the
  §7 dry run before the first real publish.
- **TypeDoc entry points** (`ir/core/config/cli`) already point at real source; the API
  reference will render the actual public surface — nothing to wire, only to eyeball
  after the first post-`0.1.0` docs build.
- **`ignore: ["@kurotako/docs"]`** already keeps the private docs app out of the release
  set; `apps/docs` is not published.

## Découpage en tâches d'implémentation

| Issue | Tâche | Portée |
|-------|-------|--------|
| [#98](https://github.com/marmotz/kurotako/issues/98) | [../../tasks/98-repo-hygiene-prose-and-community-files.md](../../tasks/98-repo-hygiene-prose-and-community-files.md) | §7, §8 — README / AGENTS.md / CONTRIBUTING.md / vision.md refresh, SECURITY.md + templates |
| [#99](https://github.com/marmotz/kurotako/issues/99) | [../../tasks/99-package-metadata-and-readmes.md](../../tasks/99-package-metadata-and-readmes.md) | §6 — `package.json` metadata + per-package `README.md` |
| [#100](https://github.com/marmotz/kurotako/issues/100) | [../../tasks/100-internal-deps-workspace-caret.md](../../tasks/100-internal-deps-workspace-caret.md) | §2, §3 — `workspace:^` migration + `baseBranch` fix |
| [#101](https://github.com/marmotz/kurotako/issues/101) | [../../tasks/101-npm-org-and-token.md](../../tasks/101-npm-org-and-token.md) | §4 — npm org + `NPM_TOKEN` (manual) |
| [#102](https://github.com/marmotz/kurotako/issues/102) | [../../tasks/102-release-workflow-enable.md](../../tasks/102-release-workflow-enable.md) | §5 — enable `release.yml`, fix job order, provenance (needs #100) |
| [#103](https://github.com/marmotz/kurotako/issues/103) | [../../tasks/103-consolidate-changesets-version-010.md](../../tasks/103-consolidate-changesets-version-010.md) | §1, §7 — one changeset, `changeset version` → 0.1.0, CHANGELOGs (needs #99, #100) |
| [#104](https://github.com/marmotz/kurotako/issues/104) | [../../tasks/104-publish-010-tag-release.md](../../tasks/104-publish-010-tag-release.md) | dry-run, publish, tag `v0.1.0`, GitHub Release, smoke test (needs #101, #102, #103) |

Branch protection (§9) stays a maintainer decision, not tracked as a task.
