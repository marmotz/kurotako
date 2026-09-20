import { defineConfig } from '@kurotako/config';
import { angularGenerator } from '@kurotako/gen-angular';
import { zodGenerator } from '@kurotako/gen-zod';
import { openapiParser } from '@kurotako/parser-openapi';

export default defineConfig({
  sources: {
    tasks: {
      use: openapiParser,
      options: { document: './apps/backend/openapi.json' },
    },
  },
  generators: [
    // Kept on purpose: the apps import `tasks/zod` themselves. `angularGenerator`
    // no longer needs this entry: it embeds its own private Zod copy under
    // `<namespace>/angular/zod/`.
    { use: zodGenerator, options: { zodVersion: 4 } },
    {
      use: angularGenerator,
      options: { forms: ['reactive', 'signal'], relations: 'flat' },
    },
  ],
  // The backend is the contract producer (its DTOs feed `openapi.json`); only the
  // frontend consumes generated code, so there is a single output destination.
  outputs: [{ dir: './apps/frontend/generated/kurotako' }],
});
