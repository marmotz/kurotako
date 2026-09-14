# CLI self-update check

**Status**: see [technical.md](technical.md)

## Context

Users install `tako` (the CLI) and `@kurotako/*` packages in their projects. There is
currently no way to know if a newer version is available, nor to be notified about it.
Since the project is `0.x` with frequent releases, staying up to date matters for
picking up fixes and new features early.

## Goal

Let the user know when a newer version of `tako` (the CLI binary) is available, and
let them check the freshness of the `@kurotako/*` packages installed in their project,
without slowing down every CLI invocation.

## Decisions made

- Scope: covers both the `tako` CLI binary and the `@kurotako/*` packages installed in
  the target project.
- `tako` binary: checked automatically, in the background, on CLI invocation. The
  check does not block the running command and its result is cached for a duration
  (8h) to avoid a network call on every invocation. If a newer version exists, a
  notice is printed (does not interrupt normal command output/exit code).
- `@kurotako/*` packages: checked on demand only, via a dedicated command `tako
  outdated`, which lists the packages installed in the current project with their
  current version vs. the latest available version.
- No auto-update: `tako` never modifies its own binary or the project's packages. Both
  checks are notification-only; the user runs their own update command (e.g. via
  npm/bun) themselves.
