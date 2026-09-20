import { defineConfig } from '@kurotako/config';
import { reactTanstackGenerator } from '@kurotako/gen-react-tanstack';
import { openapiParser } from '@kurotako/parser-openapi';

export default defineConfig({
  sources: {
    // `openapi.json` is a static contract: nothing in this project produces it.
    // The config key is the namespace, so the generated code lives under `api/`.
    api: {
      use: openapiParser,
      options: { document: './openapi.json' },
    },
  },
  generators: [
    // Hooks only for the request bodies (`Account` is a response, no form for it).
    // No `zodGenerator` entry: `reactTanstackGenerator` embeds its own private Zod copy
    // under `api/react-tanstack/zod/` and validates against it. Add one only if the app
    // imports `api/zod` itself.
    {
      use: reactTanstackGenerator,
      options: { include: ['LoginDto', 'RegisterDto'] },
    },
  ],
  // Mode A: plain `.ts` straight into the app, compiled by Vite. See
  // `tako.config.package.ts` for the mode B (npm package) variant.
  outputs: [{ dir: './src/generated' }],
});
