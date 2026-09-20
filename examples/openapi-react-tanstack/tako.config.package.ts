import { defineConfig } from '@kurotako/config';
import { reactTanstackGenerator } from '@kurotako/gen-react-tanstack';
import { openapiParser } from '@kurotako/parser-openapi';

// The same source and generator as `tako.config.ts`, emitted in mode B: one installable
// `@example/api` package (built with tsup, its `@tanstack/react-form` and `zod` peer
// dependencies declared once). Run with `tako generate --config tako.config.package.ts`.
export default defineConfig({
  sources: {
    api: {
      use: openapiParser,
      options: { document: './openapi.json' },
    },
  },
  generators: [
    {
      use: reactTanstackGenerator,
      options: { include: ['LoginDto', 'RegisterDto'] },
    },
  ],
  outputs: [
    {
      mode: 'package',
      packagesDir: './packages',
      scope: '@example',
      packageManager: 'bun',
    },
  ],
});
