---
'@kurotako/cli': minor
'@kurotako/core': patch
---

Add `tako init --package-base [--packages-dir <dir>]`, which scaffolds the `tsconfig.base.json` and `tsup.config.base.ts` that mode `package` requires, without overwriting existing files. `@kurotako/core` exports the two templates (`PACKAGE_TSCONFIG_BASE`, `PACKAGE_TSUP_CONFIG_BASE`).
