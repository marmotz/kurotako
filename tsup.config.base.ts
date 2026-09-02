import type { Options } from 'tsup';

/**
 * Shared tsup build preset. Each package's `tsup.config.ts` re-exports this,
 * overriding `entry` when the package has more than one entry point.
 */
export const basePreset: Options = {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // `composite`/`incremental` from tsconfig.base.json are for `tsc -b`; tsup's
  // one-shot d.ts compiler rejects them, so turn them off for the dts pass only.
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  target: 'node24',
  outDir: 'dist',
};
