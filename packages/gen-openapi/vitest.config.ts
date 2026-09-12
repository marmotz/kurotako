import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'gen-openapi',
    include: ['src/**/*.test.ts'],
  },
});
