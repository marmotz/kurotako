import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'kurotako',
    include: ['src/**/*.test.ts'],
  },
});
