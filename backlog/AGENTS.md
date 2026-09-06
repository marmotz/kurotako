# Backlog convention — kurotako

Local details for the `backlog-*` skills.

**Backlog mode** : github-only

GitHub issues on `marmotz/kurotako` are the single source of truth for implementation
tasks. There is no `backlog/tasks/` folder.

## Issue → feature linkage

An issue is linked to a feature by the label `feature:<slug>`, where `<slug>` is the
`backlog/features/<slug>/` folder name (`gh label create "feature:<slug>"` if missing).
Dependencies between issues are carried by `Depends on #<n>` lines in the issue body.

## Structure

- `features/<slug>/overview.md` — product discussion (skill `backlog-discuss`).
- `features/<slug>/technical.md` — technical design (skill `backlog-technical`),
  created only once `overview.md` is stable.
- `todo.md` — **generated artifact** (skill `backlog-sync`): a read-only projection of
  the GitHub issues, one section per feature. Never hand-edited. It only covers issues
  carrying a `feature:*` label; issues without one (historical/pre-migration work) are
  ignored — that history lives in `_archives/done.md`.
- `_archives/` — completed features moved out of the active backlog (skill
  `backlog-archive`): `features/<slug>/` → `_archives/features/<slug>/`, its task
  files → `_archives/tasks/`, its `todo.md` section → `_archives/done.md` (with
  `[x]` uppercased to `[X]`). Relative links are fixed in both directions on the
  move; links between files archived together keep their relative form.

## Reference documentation

Cross-cutting decisions live in `docs/` at the repo root:

- Vision and open questions: [`docs/vision.md`](../docs/vision.md)
- Architecture: [`docs/architecture.md`](../docs/architecture.md)
- IR: [`docs/ir.md`](../docs/ir.md)

The `overview.md` and `technical.md` files must reference these docs rather than
duplicate them.

## Language

Everything produced by the `backlog-*` skills is written in **English**, no exception:
`overview.md`, `technical.md`, task files, `todo.md`, and every GitHub issue / pull request
(title and body). See the root [`AGENTS.md`](../AGENTS.md) "Working conventions". The
conversation with the user may be in another language; the artifacts are not.

## GitHub repo

- `owner/repo`: **`marmotz/kurotako`** (private).
- URL prefix for link rewriting: `https://github.com/marmotz/kurotako/blob/main/`
  (adjust the branch if the default branch is not `main`).
- Issues live in this same repo.

## Suggested work order

`monorepo-bootstrap` → `ir-model` → `core-pipeline` → `config-system` → `parser-prisma`
→ `generator-zod` → `generator-angular` → `cli` → `output-modes`.
Upstream/downstream features are linked through a "Depends on" section in each
`overview.md`.
