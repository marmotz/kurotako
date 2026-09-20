import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gen-typescript',
    include: ['src/**/*.test.ts'],
    // Some tests build a full TypeScript program (loading lib.d.ts), which is slow
    // when the whole workspace runs in parallel on a loaded CI runner.
    testTimeout: 30_000,
  },
});
