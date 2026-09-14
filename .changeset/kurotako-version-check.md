---
'kurotako': patch
---

The `tako` binary now passes its own installed version to `@kurotako/cli`'s
background version-check, so the "a new version is available" notice compares
against the `kurotako` version you actually installed.
