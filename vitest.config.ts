import { defineConfig } from 'vitest/config';

// Root Vitest config. `projects` discovers each package's own vitest.config.ts
// (the `vitest.workspace.ts` file was deprecated in Vitest 3.2 and removed as the
// recommended entry point in Vitest 4; `test.projects` is functionally the same).
// Coverage is available via @vitest/coverage-v8 but not gating in v1 (no threshold).
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts'],
  },
});
