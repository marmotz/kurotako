import type { Options } from 'tsup';

export const basePreset: Options = {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  target: 'node22',
  outDir: 'dist',
};
