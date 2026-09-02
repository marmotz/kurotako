# 0007 - English throughout the project

**Status**: Accepted

**Date**: 2026-09-01

## Context

The project is meant to be published on npm under `@kurotako/*` and consumed by an international audience: contributors,
issues, docs readers, and anyone reading generated code or error messages. A mix of languages raises the barrier for
outside contributors and makes the codebase inconsistent.

## Decision

English is the only language used across the entire project, with no exception:

- **Code**: identifiers, file and directory names, comments, string literals, log and error messages, generated code and
  its identifiers.
- **Documentation**: `docs/`, ADRs, `backlog/`, `README`, package descriptions.
- **Repository metadata**: commit messages, branch names, PR and issue titles and bodies, code review comments,
  changesets.
- **CLI**: `tako` command output, help text, diagnostics.

Conversations between contributors (chat, live discussion) may happen in any language; the moment anything is written
into the repository or a tracked artifact, it is in English.

## Consequences

### Positive

- Lower barrier for external contributors; consistent with the npm ecosystem.
- No language switch cost when reading or grepping the codebase.
- Generated code and error messages fit any downstream project.

### Negative / costs

- Contributors must write in a non-native language, occasionally slower or less precise.

### Neutral

- Does not constrain the spoken working language of the team.

## Rejected alternatives

- **Bilingual docs**: doubles the maintenance surface for a solo/small team, translations drift out of sync.
