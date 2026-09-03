import { readFileSync } from 'node:fs';
import { basePreset } from '../../tsup.config.base';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

const define = { __TAKO_VERSION__: JSON.stringify(pkg.version) };

export default [
  // Library entry: dual ESM + CJS (programmatic use).
  { ...basePreset, entry: ['src/index.ts'], define },
  // Executable: ESM only (it is run, not imported / tree-shaken). Top-level
  // await in `bin/tako.ts` rules CJS out anyway.
  {
    ...basePreset,
    entry: { 'bin/tako': 'src/bin/tako.ts' },
    format: ['esm'],
    clean: false,
    define,
  },
];
