import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gen-typescript',
    include: ['src/**/*.test.ts'],
  },
});
