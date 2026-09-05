import { readFileSync } from 'node:fs';
import { basePreset } from '../../tsup.config.base';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const define = { __TAKO_VERSION__: JSON.stringify(pkg.version) };

export default [
  // Library entry: dual ESM + CJS (the `defineConfig` re-export).
  { ...basePreset, entry: ['src/index.ts'], define },
  // Executable: ESM only (top-level await in `bin/tako.ts`), like `@kurotako/cli`.
  {
    ...basePreset,
    entry: { 'bin/tako': 'src/bin/tako.ts' },
    format: ['esm'],
    clean: false,
    define,
  },
];
