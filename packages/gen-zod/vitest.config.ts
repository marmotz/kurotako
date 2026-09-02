import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gen-zod',
    include: ['src/**/*.test.ts'],
  },
});
