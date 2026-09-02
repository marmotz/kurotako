# Documentation site

**Status**: technical design in [technical.md](technical.md)

## Context

`docs/` at the repo root contains internal design documentation (vision, architecture, IR,
ADR), referenced by the backlog features. There is no user-facing documentation:
installation, configuration reference, writing a parser or a generator, catalog of the
available parsers and generators, output modes. The GitHub repo will be public, so a
published site is expected.

## Goal

A published static documentation site living inside the monorepo, covering the user-facing
surface of `tako`: quick start, `tako.config` reference, the parser/generator catalog, the
output modes, and a generated API reference. The site is a product artifact, kept distinct
from the internal `docs/` (ADR and vision stay design documents).

## Decisions made

- **Generator**: Docusaurus 3 (TypeScript config). Chosen for native folder-per-version
  documentation (`docs:version` freezes `docs/` into `versioned_docs/version-X/`) with a
  built-in version selector, no reliance on a content-archiving plugin.
- **Location**: `apps/docs` (`@kurotako/docs`, private), a non-published workspace in the
  monorepo. The root `workspaces` field gains `apps/*`. Built and deployed by CI.
- **Hosting**: GitHub Pages on a **custom domain** (name TBD), deployed from a dedicated
  `docs.yml` GitHub Actions workflow. Relies on the repo being public.
- **Versioned docs**: manual per-version folders (`versioned_docs/`), committed to git.
  The version selector tracks `@kurotako/cli` (`tako`) releases at `major.minor`
  granularity. The site is `next`-only (tracking `main`) until the first `tako` release;
  the first frozen version is cut then.
- **API reference from v1**: generated from TSDoc via TypeDoc
  (`docusaurus-plugin-typedoc`, integrated into the site build) for `@kurotako/ir`,
  `core`, `config` and `cli`. Frozen together with each docs version. TSDoc coverage on
  public symbols becomes a project constraint from the start.
- **Relationship with `docs/`**: the two stay separate. The site writes its own
  user-facing content (including a "Concepts" section covering parser / generator / IR /
  DAG / namespaces); `docs/` is not imported or duplicated. The site links to GitHub for
  design documents when relevant.
- **Vocabulary**: align on the ADR-0006 `parser` / `generator` terms. Guides are
  "writing a parser" and "writing a generator", not "writing a driver". The `driver-kit`
  reference is dropped in favour of a coherent name (e.g. `plugin-kit`, or
  `parser-kit` / `generator-kit`), to be decided in its own feature.
- **Content scope for the first publication (minimal)**: quick start, `tako.config`
  reference, parser/generator catalog, output modes, generated API reference (TypeDoc),
  and the "Concepts" section. The "writing a parser / generator" guides come as a
  fast-follow.

## Depends on

- No code dependency. Makes sense once [cli](../cli/overview.md) and
  [config-system](../config-system/overview.md) are stable.
- API reference depends on the public packages exposing TSDoc-annotated symbols.
- Requires the GitHub repo to be public (publishing, deployment CI) — see
  [backlog/AGENTS.md](../../AGENTS.md).
- Forces an amendment to [monorepo-bootstrap](../monorepo-bootstrap/technical.md)
  (`apps/*` workspace, `.gitignore`, Biome, changesets, `CONTRIBUTING.md`) — one task on
  that feature.
- Related: a future `plugin-kit` / `parser-kit` feature for the "writing a parser /
  generator" guides.
