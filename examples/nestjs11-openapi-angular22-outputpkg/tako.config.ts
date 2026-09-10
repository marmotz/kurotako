import { defineConfig } from '@kurotako/config';
import { angularGenerator } from '@kurotako/gen-angular';
import { typescriptGenerator } from '@kurotako/gen-typescript';
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
    { use: typescriptGenerator },
    { use: zodGenerator, options: { zodVersion: 4 } },
    {
      use: angularGenerator,
      options: { forms: ['reactive', 'signal'], relations: 'flat' },
    },
  ],
  // Mode B: a single shared `@example/tasks` workspace package that the backend
  // (contract producer) does not consume and the frontend imports as a normal
  // dependency.
  outputs: [
    {
      mode: 'package',
      packagesDir: './packages',
      scope: '@example',
      packageManager: 'bun',
    },
  ],
});
