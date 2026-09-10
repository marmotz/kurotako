import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The pipeline integration test (`src/integration.test.ts`) drives the sibling
 * generator packages directly. Alias them to their TypeScript sources so the
 * test always exercises the current tree rather than a stale published bundle.
 */
const pkg = (name: string) =>
  fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: { name: 'parser-openapi', include: ['src/**/*.test.ts'] },
  resolve: {
    alias: {
      '@kurotako/gen-zod': pkg('gen-zod'),
      '@kurotako/gen-typescript': pkg('gen-typescript'),
      '@kurotako/gen-angular': pkg('gen-angular'),
    },
  },
});
