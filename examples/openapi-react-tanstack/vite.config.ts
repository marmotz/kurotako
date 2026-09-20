import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The generated code imports its own modules as `api/...`, the namespace being
    // the config key. `tsconfig.json` `paths` says the same for the typechecker.
    alias: { api: path.resolve(import.meta.dirname, 'src/generated/api') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.tsx'],
  },
});
