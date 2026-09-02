import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'parser-prisma',
    include: ['src/**/*.test.ts'],
  },
});
