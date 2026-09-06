# AGENTS.md — kurotako

Guidance for AI agents working in this repository.

## What this project is

kurotako is a modular framework for synchronizing TypeScript schemas from the data
model down to frontend forms, through a validation layer. CLI binary: `tako`.
Packages are published under `@kurotako/*`.

Pipeline model: **parsers** (schema source -> partial IR under a namespace) and
**generators** (IR + dependency artifacts -> code), wired by a dependency DAG. There is
no fixed middle stage. See [`docs/architecture.md`](docs/architecture.md).

## Project status

MVP implemented: `kurotako` + `@kurotako/*` are versioned at `0.1.0` and published to npm
under `latest`. Code lives under `packages/` (8 publishable packages) and `apps/` (the private
Docusaurus site, deployed to <https://kurotako.marmotz.dev/>). The GitHub repo
`marmotz/kurotako` is public; `develop` is the default branch and also carries the
backlog issues. `0.x`: the public API may still change between minor versions.

## Where things live

- [`docs/vision.md`](docs/vision.md) — problem, positioning, MVP scope, open questions.
- [`docs/architecture.md`](docs/architecture.md) — parsers, generators, IR, DAG, output modes.
- [`docs/ir.md`](docs/ir.md) — intermediate representation draft.
- [`docs/glossary.md`](docs/glossary.md) — project vocabulary.
- [`backlog/`](backlog/) — features in discussion and implementation tasks.
- [`backlog/AGENTS.md`](backlog/AGENTS.md) — conventions for the `backlog-*` skills.

Cross-cutting decisions belong in `docs/`. Feature files under `backlog/features/`
must reference those docs, not duplicate them.

## Decisions already locked (see docs/vision.md "Decisions already made")

- Name `kurotako`, scope `@kurotako/*`, binary `tako`.
- No "middle" stage; generators form a DAG via `dependsOn`, core computes topological order.
- Multiple parsers active at once; each config key is a namespace; one parser package can be instantiated several times.
- IR keyed `(namespace, entity)`; homonyms never merged; generated identifiers are deterministic and never prefixed; namespace only drives output location.
- Two output modes: A directory (default), B npm package per source.
- `parser` / `generator` vocabulary.

## Toolchain

Defined in [`backlog/_archives/features/monorepo-bootstrap/technical.md`](backlog/_archives/features/monorepo-bootstrap/technical.md):
Bun workspaces, TypeScript (`tsc -b`, project references), tsup build, vitest,
Biome lint/format, lefthook hooks, changesets (independent versioning), GitHub Actions CI.
Node >= 24. Published code must run unmodified on Node and Bun — no `Bun.*` APIs in packages.

## Working conventions

- **Everything is written in English**, with no exception: prose, code identifiers, file
  names, comments, strings, commit messages, branch names, and every GitHub issue and pull
  request (title and body). This includes `docs/` and `backlog/` (features, technical
  designs, tasks, `todo.md`). Chat with the user may be in another language, but nothing
  that lands in the repo or on GitHub is.
- Every implementation (feature, fix, refactor) ships with its test changes; nothing is complete until its tests pass.
- After a code change, run the affected tests and the typecheck (`tsc -b`).
- Every significant change to a published package (new public API, breaking change,
  notable fix) ships with a changeset (`bunx changeset` or a hand-written file under
  `.changeset/`, see [`.changeset/README.md`](.changeset/README.md)). Skip it only for
  changes with no user-facing effect (docs, backlog, internal refactor with no API change).
- Do not invent APIs, versions, or package names — verify against `docs/`.
- Suggested feature order: `monorepo-bootstrap` -> `ir-model` -> `core-pipeline` -> `config-system` -> `parser-prisma` -> `gen-zod` -> `gen-angular` -> `cli` -> `output-modes`.
