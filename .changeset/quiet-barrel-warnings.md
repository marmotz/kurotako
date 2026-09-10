---
'@kurotako/core': patch
'@kurotako/cli': patch
---

Make the ambiguous root-barrel export warning understandable.

- `@kurotako/core`: when several generators export identically-named
  declarations under one namespace, `synthesizeRootBarrels` now emits a single
  plain-language warning per namespace instead of one terse line per identifier.
  It says what caused the clash, that it is not an error, which import path
  yields which declaration, and how to silence it, plus a bounded deterministic
  sample of the affected names. The full per-identifier detail
  (`collisionCount`, `identifiers`, `sample`, `resolutions`) stays on the
  warning's structured meta object. The warning fires once from the aggregate
  tree rather than once per configured output, and the generated barrel content
  is unchanged.
- `@kurotako/core`: `OutputNotGeneratedError` now explains the `"//"` marker and
  the two ways to unblock the path (delete the directory, or add the marker).
- `@kurotako/cli`: `ConsoleReporter` prints the human-readable message at
  `info` / `warn` / `error` level and appends the structured `meta` object only
  with `--debug`. A custom `Logger` still receives `meta` in full, so default
  output stays prose instead of `key=value` noise.
