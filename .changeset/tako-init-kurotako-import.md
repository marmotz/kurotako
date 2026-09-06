---
"@kurotako/config": patch
---

`tako init` now writes `import { defineConfig } from 'kurotako'` in the generated
`tako.config.ts` (both the single-project and `--monorepo` templates), matching the
"install one name" story. Projects that depend on `@kurotako/config` directly just change
that one import line.
